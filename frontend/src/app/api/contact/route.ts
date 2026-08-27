import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin, NO_STORE } from "@/lib/admin-guard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** Longer than the admin proxy's: this is a write a person is waiting on, and
 *  a Render free instance can take ~60s to answer its first request. */
const UPSTREAM_TIMEOUT_MS = 30_000;

/**
 * Contact / research request intake, proxied.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS ROUTE EXISTS
 *
 * `submitContactRequest` used to `fetch` the FastAPI origin straight from the
 * browser. That made every submission a cross-origin request, so it worked
 * only while `CORS_ORIGINS` on the API happened to list the exact frontend
 * origin the visitor was on — and it fails in the worst possible way when it
 * does not. The browser blocks the response before any of our code sees it,
 * `fetch` rejects with a bare `TypeError`, and the form's catch-all renders
 * "That didn't send." A CORS misconfiguration on the API therefore presents as
 * a broken form on the site, with nothing in the frontend logs and a clean 202
 * in the API's. render.yaml already warns about exactly this:
 *
 *   > CORS. Must list the real frontend origin. A wrong value here fails only
 *   > in the browser, which makes it look like a frontend bug.
 *
 * Posting here instead makes the submission same-origin. The API call happens
 * server-side, where CORS does not apply at all, so the form cannot be broken
 * by a deploy-time environment mismatch and the API origin stops being a thing
 * the page has to reach directly.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE PROXY MUST NOT SWALLOW
 *
 * Two things, and both were bugs waiting to happen:
 *
 *   1. **The client IP.** Every request now leaves the same server, so without
 *      forwarding it, the API sees one address for the whole world. It keys the
 *      20/minute write limit on that address — so one busy minute would lock
 *      the form for every visitor, and the `source_ip` recorded against every
 *      message would be a data-centre address. The header is rebuilt from the
 *      connecting client rather than passed through, so a caller cannot spoof
 *      one by sending their own.
 *
 *   2. **The status code.** The form needs to tell "we are rate-limiting you"
 *      (429) from "that email is not valid" (422) from "the API is down" (502).
 *      The upstream status and body are returned verbatim so the UI can say
 *      which.
 */
export async function POST(request: NextRequest) {
  // Unauthenticated, so this is not CSRF protection — there is no session to
  // ride. It is here to keep the endpoint from being a convenient open relay
  // into our moderation queue for a script pointed at it from elsewhere.
  if (!sameOrigin(request)) {
    return NextResponse.json({ detail: "forbidden" }, { status: 403, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "invalid body" }, { status: 400, headers: NO_STORE });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ detail: "invalid body" }, { status: 400, headers: NO_STORE });
  }

  // The address the browser actually connected from, per the platform's own
  // header — not whatever the payload or a hand-set header claims. Taking the
  // first entry is the standard reading: proxies append, so the leftmost is
  // the original client.
  const clientIp = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();

  try {
    const res = await fetch(`${API_URL}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
        // Kept because the API stores it as abuse metadata; truncated there.
        "User-Agent": request.headers.get("user-agent") ?? "sortedchoice-web",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch (err) {
    // Never reflect the upstream error — it names internal hosts and ports.
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return NextResponse.json(
      {
        detail: timedOut
          ? "The desk did not answer in time. Your message was not sent — try again."
          : "Could not reach the desk just now. Try again in a moment.",
      },
      { status: timedOut ? 504 : 502, headers: NO_STORE },
    );
  }
}
