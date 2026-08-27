import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/supabase/server";
import { CONTENT_TAG } from "@/lib/cache-tags";

/**
 * The single gate every `/admin/api/*` Route Handler passes through.
 *
 * These handlers exist because the session token lives in an `httpOnly` cookie
 * that client JavaScript deliberately cannot read — that property is what stops
 * an XSS bug stealing a session. The cost of that design is that these routes
 * are **cookie-authenticated**: the browser attaches credentials automatically,
 * which is exactly the precondition for CSRF. So every check below is here
 * because the cookie makes it necessary, not as ceremony:
 *
 *   1. `sameOrigin` — a cross-site page must not be able to drive these.
 *   2. `getAdminSession` — admin role *and* aal2, from signed claims.
 *   3. `isId` — path segments are validated before they reach a URL template.
 *
 * None of this is the authorization boundary. FastAPI re-verifies the signed
 * token, the role and the AAL on every request (`app/core/deps.py`), and RLS
 * refuses the row at the database. This layer exists so a request that should
 * never have been made does not reach either of them.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** A hung upstream should fail the request, not pin a server worker forever. */
const UPSTREAM_TIMEOUT_MS = 15_000;

/** Methods that change state, and therefore need an origin check. */
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Admin responses carry unpublished content. Nothing may cache them. */
const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "X-Content-Type-Options": "nosniff",
} as const;

/**
 * The 8-4-4-4-12 shape, and nothing else.
 *
 * Without this an id from the URL is interpolated straight into an upstream
 * path, so `..%2f..%2fusers` reaches an endpoint this route was never meant to
 * expose — with the caller's own admin token attached. Version and variant
 * nibbles are deliberately not checked: the goal is to exclude separators and
 * traversal, not to police which UUID generator produced the value.
 */
const ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isId(value: string | undefined | null): value is string {
  return typeof value === "string" && ID_RE.test(value);
}

/**
 * Is this request from our own origin?
 *
 * Compared against the `Host` the browser actually connected to rather than a
 * configured base URL, so this keeps working behind a reverse proxy without a
 * second thing to keep in sync.
 *
 * A state-changing request with no `Origin` and no `Sec-Fetch-Site` is refused
 * rather than trusted. Every browser that can reach these routes sends at least
 * one of the two on an unsafe method; a caller that sends neither is not a
 * browser, and a non-browser client should be talking to the FastAPI API with a
 * bearer token instead of borrowing a cookie session.
 */
export function sameOrigin(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "same-origin" || site === "none") return true;
  // Explicitly cross-site, per the browser itself. Nothing else to weigh up.
  if (site === "cross-site" || site === "same-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export type Guard =
  | { ok: true; token: string }
  | { ok: false; response: NextResponse };

function refuse(status: number, detail: string): { ok: false; response: NextResponse } {
  return {
    ok: false,
    response: NextResponse.json({ detail }, { status, headers: NO_STORE }),
  };
}

/**
 * Authorise the caller and hand back their access token.
 *
 * The token is the caller's own — never a service-role key. It grants nothing
 * this caller does not already have; it only carries their identity upstream.
 */
export async function guard(request: NextRequest): Promise<Guard> {
  if (UNSAFE_METHODS.has(request.method) && !sameOrigin(request)) {
    // Deliberately not "CSRF": the message is for our own logs, not a probe's.
    return refuse(403, "forbidden");
  }

  const session = await getAdminSession();
  if (!session.ok) {
    // `mfa_required` is distinguished so the client prompts for a code rather
    // than showing "access denied" to an admin who simply has a step left.
    if (session.reason === "mfa_required") return refuse(403, "mfa_required");
    if (session.reason === "anonymous") return refuse(401, "unauthenticated");
    return refuse(403, "forbidden");
  }

  return { ok: true, token: session.token };
}

/**
 * Clear the public content cache after a write.
 *
 * Sits here rather than in each of the 48 Route Handlers deliberately: every
 * admin mutation already funnels through `forward()`, so this is the one place
 * that cannot be forgotten by a handler added later. A handler that had to
 * remember to call it would eventually be the one that did not — which is
 * precisely how a published product came to be invisible on the homepage for
 * five minutes at a time (see lib/cache-tags.ts).
 *
 * One coarse tag rather than a per-resource map. Admin writes are rare and a
 * category rename genuinely does change the homepage, the category rail, the
 * breadcrumb on every product page and the sitemap; working out which of those
 * a given PATCH touched is a guess that fails silently when it is wrong. The
 * next public request re-fetches. That is the correct trade for a few writes a
 * day, and it is not the trade to make for a few writes a second.
 */
function revalidatePublicContent(): void {
  try {
    // `{ expire: 0 }` — no stale-while-revalidate window. Next 16 takes a
    // cacheLife profile here saying how stale an entry may still be served
    // while it refreshes in the background; anything above zero would hand the
    // NEXT reader the old page and only correct the one after, which is the
    // behaviour being fixed. An editor who publishes and opens the site in the
    // next tab has to see it there.
    revalidateTag(CONTENT_TAG, { expire: 0 });
  } catch {
    // A failed invalidation must never fail the write that succeeded. The
    // worst case is the old behaviour: the change appears within REVALIDATE
    // seconds instead of on the next request.
  }
}

/**
 * Forward one already-validated request to the API.
 *
 * `path` must be built from literals and values that have passed `isId` — it is
 * appended to the API base with no further escaping, by design, because
 * escaping here would break the legitimate slashes in `/products/<id>/videos`.
 */
export async function forward(
  token: string,
  path: string,
  init: { method?: string; body?: unknown; form?: FormData; query?: URLSearchParams } = {},
): Promise<NextResponse> {
  const { method = "GET", body, form, query } = init;
  const qs = query && [...query.keys()].length ? `?${query}` : "";

  try {
    const res = await fetch(`${API_URL}${path}${qs}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    // Only on a write, and only on one the API actually accepted — a 422 that
    // changed nothing should not churn the cache for every reader.
    if (method !== "GET" && res.ok) revalidatePublicContent();

    if (res.status === 204) return new NextResponse(null, { status: 204, headers: NO_STORE });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch (err) {
    // Never reflect the upstream error: it carries internal hostnames and
    // ports. The status is the whole message the client gets.
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return NextResponse.json(
      { detail: timedOut ? "The API did not respond in time." : "Upstream unavailable" },
      { status: timedOut ? 504 : 502, headers: NO_STORE },
    );
  }
}

/**
 * Parse a JSON body without letting malformed input become a 500.
 *
 * Returns `undefined` for an absent or unparseable body; handlers that require
 * one check for that and answer 400.
 */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

/** 400 for a path segment that is not a well-formed id. */
export function badId(): NextResponse {
  return NextResponse.json({ detail: "invalid id" }, { status: 400, headers: NO_STORE });
}

/** 400 for a missing or unparseable JSON body. */
export function badBody(): NextResponse {
  return NextResponse.json({ detail: "invalid body" }, { status: 400, headers: NO_STORE });
}

export { NO_STORE };
