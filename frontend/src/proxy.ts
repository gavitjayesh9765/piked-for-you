import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, HSTS_HEADER, STATIC_SECURITY_HEADERS } from "@/lib/security-headers";
import { safeInternalPath } from "@/lib/safe-path";

/**
 * Session refresh + `/admin` gate.
 *
 * ⚠ THIS IS NOT A SECURITY BOUNDARY.
 *
 * It is a fast redirect so a signed-out visitor sees a login page instead of an
 * empty dashboard, and so a password-only admin lands on enrolment instead of a
 * dashboard whose every button 403s. Anyone can call the API directly and skip
 * it entirely — which is fine, because:
 *
 *   1. FastAPI verifies the JWT signature and `app_metadata.role` on every
 *      single admin request (`app/core/deps.py`).
 *   2. Row Level Security refuses the row at the database even if the API
 *      layer has a bug.
 *
 * Route protection is not authorization (docs/03-architecture.md). Treating
 * the proxy as the control is a classic Next.js mistake — this file exists for
 * UX, and the real gate is two layers deeper.
 */
export async function proxy(request: NextRequest) {
  // Fresh nonce per request. Crypto-random, never derived from anything the
  // client controls — a predictable nonce is no nonce at all.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const csp = buildCsp(nonce, isDev);

  // Next reads x-nonce off the request and stamps it onto its own <script>
  // tags, so framework code keeps working under a strict CSP.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  // Server Components cannot see the current pathname. Layouts that redirect a
  // signed-out visitor to a login page need it, or they have to hardcode a
  // destination and throw away where the visitor was actually going.
  requestHeaders.set("x-pathname", request.nextUrl.pathname + request.nextUrl.search);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  function applySecurityHeaders<T extends NextResponse<unknown>>(res: T): T {
    res.headers.set("content-security-policy", csp);
    // Unpublished content and moderation queues. Nothing between us and the
    // browser may keep a copy, and the browser may not restore one on Back.
    if (request.nextUrl.pathname.startsWith("/admin")) {
      res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    }
    for (const [k, v] of Object.entries(STATIC_SECURITY_HEADERS)) res.headers.set(k, v);
    if (!isDev) res.headers.set("Strict-Transport-Security", HSTS_HEADER);
    return res;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Unconfigured. Fail CLOSED on /admin: with no way to verify a session we
  // cannot establish that anyone is an admin, and "we couldn't check" must
  // never resolve to "allowed". The public site still renders, since it
  // exposes nothing that requires a session.
  if (!url || !key) {
    if (request.nextUrl.pathname.startsWith("/admin")) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/admin/login";
      redirect.search = "?error=unconfigured";
      return applySecurityHeaders(
        request.nextUrl.pathname === "/admin/login"
          ? NextResponse.next({ request: { headers: requestHeaders } })
          : NextResponse.redirect(redirect),
      );
    }
    return applySecurityHeaders(response);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getUser() validates against the auth server. getSession() would only read
  // the cookie, so a forged cookie would be believed — never use it here.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminLogin = pathname === "/admin/login";
  // The two routes a half-authenticated admin must still reach: the door, and
  // the page where they enrol the factor that gets them the rest of the way.
  const isEnrolmentRoute = pathname === "/admin/security";
  // Route handlers, not pages. These must answer with a status code — a 307 to
  // a login page is not something a fetch() caller can act on.
  const isAdminApi = pathname.startsWith("/admin/api");

  /**
   * The session's assurance level, from the signed claims.
   *
   * Any failure to establish it — bad signature, missing claim, unreachable
   * JWKS — resolves to null, which every caller treats as "not aal2".
   */
  async function resolveAal(): Promise<string | null> {
    try {
      const { data, error } = await supabase.auth.getClaims();
      if (error) throw error;
      return (data?.claims?.aal as string | undefined) ?? null;
    } catch (err) {
      // Denying is correct, but a systemic failure here locks out every admin
      // at once and looks identical to "you need to enrol". Say so in the log
      // rather than leaving it to be guessed at.
      console.error("[proxy] could not resolve AAL, denying:", err);
      return null;
    }
  }

  function deny(status: number, error: string, redirectTo: string) {
    if (isAdminApi) {
      return applySecurityHeaders(NextResponse.json({ error }, { status }));
    }
    const redirect = request.nextUrl.clone();
    redirect.pathname = redirectTo;
    redirect.search = "";
    // Carry the intended destination through BOTH gates. Only the path is
    // kept — never an absolute URL, which would make this an open redirect an
    // attacker could point at their own site.
    //
    // The security route used to get `enrol=1` and nothing else, so an admin
    // sent there to finish their second factor lost wherever they had been
    // heading and was dropped on the dashboard instead. Both interruptions
    // are resumable; both should resume.
    if (redirectTo === "/admin/login" || redirectTo === "/admin/security") {
      // Path *and* query. Using the bare pathname dropped pagination, filters
      // and search state, so returning from login landed on an unfiltered
      // first page rather than the view they had open.
      redirect.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return applySecurityHeaders(NextResponse.redirect(redirect));
  }

  if (isAdminRoute && !isAdminLogin) {
    if (!user) {
      // Preserve the destination so login can return them to it. Only the
      // path is kept — never an absolute URL, which would make this an open
      // redirect an attacker could point at their own site.
      return deny(401, "unauthenticated", "/admin/login");
    }

    const role = (user.app_metadata as Record<string, unknown> | undefined)?.role;
    if (role !== "admin") {
      // A signed-in shopper hitting /admin. Send them home rather than to a
      // login page — they are authenticated, just not authorised.
      return deny(403, "forbidden", "/");
    }

    // ---- Second factor -------------------------------------------------
    // `getUser()` says who they are; it says nothing about how hard they had
    // to work to prove it. AAL lives in the signed token claims and nowhere
    // else, so read it from there. Any failure to establish aal2 — bad
    // signature, missing claim, unreachable JWKS — is treated as aal1.
    if (!isEnrolmentRoute && (await resolveAal()) !== "aal2") {
      return deny(403, "mfa_required", "/admin/security");
    }
  }

  // Already **fully** signed in and visiting the admin login page: skip it.
  //
  // The aal2 check is load-bearing, not decoration. This used to fire on role
  // alone, and an admin at the TOTP step is signed in with the admin role —
  // so any reload or re-navigation mid-login bounced them to /admin, which the
  // gate above immediately bounced on to /admin/security. The code field they
  // were typing into lived on the page they had just been thrown off, and no
  // route would take them back to it. Half-authenticated admins belong on the
  // login page; that is where the second step is.
  if (isAdminLogin && user) {
    const role = (user.app_metadata as Record<string, unknown> | undefined)?.role;
    if (role === "admin" && (await resolveAal()) === "aal2") {
      const redirect = request.nextUrl.clone();
      // Honour where they were originally headed instead of always dumping
      // them on the dashboard.
      // Path *and* query, via the shared validator — see lib/safe-path.ts
      // for why a `startsWith("/")` test is not enough.
      const dest = new URL(
        safeInternalPath(request.nextUrl.searchParams.get("next"), "/admin"),
        request.nextUrl.origin,
      );
      redirect.pathname = dest.pathname;
      redirect.search = dest.search;
      return applySecurityHeaders(NextResponse.redirect(redirect));
    }
  }

  return applySecurityHeaders(response);
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image files — the session cookie
     * needs refreshing on real navigations, not on every .svg.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)",
  ],
};
