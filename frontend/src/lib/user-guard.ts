import { NextResponse, type NextRequest } from "next/server";
import { getUserSession } from "@/lib/supabase/server";
import { sameOrigin } from "@/lib/admin-guard";

/**
 * The gate every `/api/*` shopper Route Handler passes through.
 *
 * This is the same reasoning `lib/admin-guard.ts` sets out, applied to the
 * surface that was missing it. Its header says the quiet part already:
 *
 *   > these routes are **cookie-authenticated**: the browser attaches
 *   > credentials automatically, which is exactly the precondition for CSRF.
 *
 * Every admin handler went through that check. Every shopper handler called
 * `getAccessToken()` directly and skipped it — same cookie, same automatic
 * attachment, no origin test. Two of these routes are reachable by a
 * cross-site form with no preflight to stop them:
 *
 *   /api/reviews/media   reads `request.formData()`, and multipart/form-data
 *                        is a CORS-simple content type
 *   /api/reviews,
 *   /api/me/saved        call `request.json()`, which parses the body
 *                        regardless of Content-Type — so a form posted as
 *                        `enctype="text/plain"` with a JSON-shaped body lands
 *                        as a valid request
 *
 * An attacker's page could therefore post reviews, upload media, file reports
 * and rewrite a victim's saved list, silently, while they were signed in.
 *
 * As with the admin guard: this is not the authorization boundary. FastAPI
 * verifies the signed token on every request and RLS refuses the row at the
 * database. This exists so a request that should never have been made does not
 * reach either of them.
 */

/** Methods that change state, and therefore need an origin check. */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Personal data. Nothing between us and the browser may keep a copy. */
const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "X-Content-Type-Options": "nosniff",
} as const;

export type UserGuard =
  | { ok: true; token: string; userId: string }
  | { ok: false; response: NextResponse };

function refuse(status: number, detail: string): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json({ detail }, { status, headers: NO_STORE }),
  };
}

/**
 * Authorise the caller and hand back their own access token.
 *
 * The token is the caller's own — never a service-role key. It grants nothing
 * this caller does not already have; it only carries their identity upstream.
 */
export async function userGuard(request: NextRequest): Promise<UserGuard> {
  if (UNSAFE_METHODS.has(request.method) && !sameOrigin(request)) {
    // Deliberately not "CSRF": the message is for our own logs, not a probe's.
    return refuse(403, "forbidden");
  }

  const session = await getUserSession();
  if (!session.ok) return refuse(401, "Sign in to continue.");

  return { ok: true, token: session.token, userId: session.userId };
}

/**
 * Path segments are validated before they reach a URL template.
 *
 * Re-exported from the admin guard rather than redefined, because the reason
 * is identical and stated there: an id interpolated straight into an upstream
 * path lets `..%2f..%2f` reach an endpoint this route was never meant to
 * expose, with the caller's own token attached.
 */
export { isId, badId, badBody, readJson } from "@/lib/admin-guard";
export { NO_STORE };
