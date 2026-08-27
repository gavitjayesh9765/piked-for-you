import { NextResponse, type NextRequest } from "next/server";

import { sameOrigin, NO_STORE } from "@/lib/admin-guard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

/**
 * Shorter than every other proxy in this directory, and deliberately so.
 *
 * Nobody is waiting on this: the page has already rendered and the beacon is
 * fire-and-forget. A cold Render instance taking 60s to answer would hold a
 * serverless invocation open for a counter nobody will read until tomorrow, so
 * this gives up early and drops the event instead.
 */
const UPSTREAM_TIMEOUT_MS = 4_000;

/**
 * The tracking beacon, proxied same-origin.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS, WHICH IS A MISTAKE ALREADY MADE TWICE IN THIS REPO
 *
 * The beacon originally posted straight from the browser to the API. That is
 * cross-origin, and the API's `CORS_ORIGINS` does not name the site — every
 * preflight came back `400 Disallowed CORS origin`, so the browser would have
 * killed every beacon before any of our code ran and the counters would have
 * sat at zero forever, with nothing in any log to say why.
 *
 * `app/api/contact/route.ts` and `app/api/newsletter/route.ts` exist for
 * exactly this reason, and the comment on the second one already calls the
 * newsletter "the second and last public write still calling the API straight
 * from the browser". It was not the last. This is the third, and it is now
 * routed the same way.
 *
 * Same-origin also removes the CORS preflight entirely, which halves the
 * request count for the most frequently fired call on the site.
 *
 * The alternative — adding the site origin to `CORS_ORIGINS` on Render — fixes
 * one deployment and breaks on the next preview URL and the next custom
 * domain, and it is a dashboard setting nothing in this repo can verify. This
 * works everywhere the site is served from, with no configuration at all.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS FORWARDED, AND WHY EACH ONE MATTERS
 *
 *   X-Forwarded-For — the real visitor's address. Without it the API sees one
 *     Vercel egress address for the entire internet, keys its rate limit on
 *     that, and starts dropping everyone's beacons as one abusive client. The
 *     API runs uvicorn with `--proxy-headers --forwarded-allow-ips='*'`, so
 *     this reaches the limiter. It is used for rate limiting and nothing else,
 *     and is never stored — the analytics tables have no IP column.
 *
 *   User-Agent — the API filters bots and buckets the device from it. Dropped,
 *     every visit would be classified `desktop` and the crawler filter would
 *     see this proxy's own agent on every request and discard the entire
 *     internet, or none of it.
 *
 *   Origin — the API compares referrers against it to drop same-site ones.
 *     Rebuilt from this request's own host when the browser omits it, which
 *     `sendBeacon` sometimes does.
 */
export async function POST(request: NextRequest) {
  // Not CSRF protection — there is no session to ride, and every field here is
  // anonymous. It keeps this from being a convenient endpoint to inflate
  // someone's click counts from a script pointed at it from elsewhere.
  if (!sameOrigin(request)) {
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // 204 rather than 400. This endpoint's contract is that it is never
    // observable — see the header of backend/app/modules/analytics/router.py.
    return new NextResponse(null, { status: 204, headers: NO_STORE });
  }

  const clientIp = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim();
  const userAgent = request.headers.get("user-agent");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const origin =
    request.headers.get("origin") ?? (host ? `https://${host}` : undefined);

  try {
    await fetch(`${API_URL}/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(clientIp ? { "X-Forwarded-For": clientIp } : {}),
        ...(userAgent ? { "User-Agent": userAgent } : {}),
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch {
    /* A dropped counter is not an error worth reporting to anybody. */
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE });
}
