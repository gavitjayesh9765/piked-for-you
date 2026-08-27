import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin, NO_STORE } from "@/lib/admin-guard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/** A person is waiting on this, and a Render free instance can take ~60s to
 *  answer its first request after spinning down. */
const UPSTREAM_TIMEOUT_MS = 30_000;

/**
 * Newsletter signup, proxied.
 *
 * The same fix, for the same reason, as app/api/contact/route.ts — and the
 * newsletter was the second and last public write still calling the API
 * straight from the browser. That made it cross-origin, so it worked only
 * while the API's `CORS_ORIGINS` named the exact frontend origin, and when it
 * did not the browser killed the response before any of our code ran. render.yaml
 * already says what that looks like: "a wrong value here fails only in the
 * browser, which makes it look like a frontend bug."
 *
 * That risk is not theoretical here. The whole point of the current phase is to
 * COLLECT addresses now and send in a month or two, so a signup that silently
 * fails costs a subscriber who cannot be recovered — there is no record of them
 * to retry. Making the call same-origin removes the failure mode entirely.
 *
 * The client IP is rebuilt from the connecting client rather than passed
 * through: without it the API sees one address for the whole world, keys its
 * 20/minute write budget on it, and records a data-centre address as the
 * consent provenance in `signup_ip` — which is the column that answers "where
 * did this consent come from?" if anyone ever asks.
 */
export async function POST(request: NextRequest) {
  // Unauthenticated, so not CSRF protection — there is no session to ride. It
  // keeps this from being a convenient way to stuff our subscriber table from
  // a script pointed at it from somewhere else.
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

  const clientIp = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();

  try {
    const res = await fetch(`${API_URL}/newsletter/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const data = await res.json().catch(() => null);
    return NextResponse.json(data ?? {}, { status: res.status, headers: NO_STORE });
  } catch (err) {
    const timedOut = err instanceof DOMException && err.name === "TimeoutError";
    return NextResponse.json(
      { detail: timedOut ? "That took too long. Try again." : "Could not sign you up just now." },
      { status: timedOut ? 504 : 502, headers: NO_STORE },
    );
  }
}
