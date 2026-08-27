/**
 * The tracking beacon, client side.
 *
 * Posts to `POST /api/track` — OUR OWN origin, not the API's. That route
 * (`app/api/track/route.ts`) forwards to the backend. See its header for why:
 * the short version is that the API's `CORS_ORIGINS` does not name this site,
 * so a direct call was rejected at the preflight and every beacon died in the
 * browser with nothing in any log to say so. Same-origin also means no
 * preflight at all, which halves the requests for the most frequently fired
 * call on the site.
 *
 * See `backend/app/modules/analytics/router.py` for what happens at the far
 * end and `supabase/migrations/20260827180440_analytics_daily.sql` for why the
 * payload is as thin as it is.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS SENDS, AND WHAT IT DELIBERATELY DOES NOT
 *
 * Sends: a kind (`view` or `click`), sometimes a product id, sometimes a
 * retailer id, `location.pathname`, and `document.referrer`.
 *
 * Does not send, and must not be extended to send: any identifier for the
 * person. No session id, no visitor id, no user id even when one is available
 * from the session, no fingerprint, no screen size, no timezone. The server
 * folds the path to a route shape and the referrer to a bare host and stores
 * counters, so there is nothing on either end that could be joined back to a
 * reader. That is what allows this site to count its traffic without a consent
 * banner, and it is a property of the payload — one extra field ends it.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY FAILURE IS SILENT
 *
 * Analytics is the least important thing on any page it runs on. A blocked
 * request, an ad blocker, an offline reader, a CORS misconfiguration — none of
 * these are the reader's problem, and none should reach the console of someone
 * who came to read a review. The counters are approximate by design; a beacon
 * that throws would be a bug with real consequences in exchange for a number
 * that was never exact.
 */

export type TrackPayload = {
  kind: "view" | "click";
  productId?: string;
  retailerId?: string;
  /**
   * The `product_retailers` row id behind the clicked button. Preferred over
   * the two ids above for clicks: the server resolves both the product and
   * the retailer from it, so the pair is always one that really exists.
   */
  linkId?: string;
  /** `location.pathname` only. Query strings are dropped before sending. */
  path?: string;
  referrer?: string;
};

/**
 * Relative, so it resolves against whatever origin the page is served from —
 * the production domain, a Vercel preview URL, or localhost — with no
 * configuration and nothing to keep in step.
 */
const TRACK_URL = "/api/track";

export function track(payload: TrackPayload): void {
  if (typeof window === "undefined") return;

  const url = TRACK_URL;
  const body = JSON.stringify(payload);

  try {
    /**
     * `sendBeacon` first, and the Blob is not decoration.
     *
     * A bare `sendBeacon(url, string)` sends `text/plain`, which FastAPI
     * refuses to parse as a JSON body — the endpoint would 422 every beacon
     * and, because nothing here reads the response, it would do so invisibly.
     * The Blob is the only way to set a content type on a beacon.
     *
     * `application/json` would make this a non-simple request and trigger a
     * preflight if it were cross-origin. It is not — the URL is relative, so
     * this is same-origin and no preflight happens regardless of content type.
     */
    const sent = navigator.sendBeacon?.(
      url,
      new Blob([body], { type: "application/json" }),
    );
    if (sent) return;
  } catch {
    /* fall through to fetch */
  }

  /**
   * The fallback, for browsers without sendBeacon and for the case where it
   * returns false (the user agent's queue is full).
   *
   * `keepalive` is what makes this survive the navigation it is often racing —
   * an outbound retailer click unloads the page immediately, and a plain fetch
   * would be cancelled in flight. `catch(() => {})` rather than nothing,
   * because an unhandled rejection is a console error on a reader's page.
   */
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
    // `same-origin` rather than `omit`: the route handler checks `sameOrigin()`
    // on the way in, and Sec-Fetch-Site is what carries that.
    credentials: "same-origin",
  }).catch(() => {});
}

/**
 * An outbound retailer click.
 *
 * Called from an event handler that is about to let the browser navigate away,
 * which is exactly the case `keepalive`/`sendBeacon` exist for. It never
 * preventDefault()s and never delays the navigation: a reader who clicked
 * "View on Amazon" goes to Amazon at the same speed whether this succeeds,
 * fails, or is blocked outright.
 */
export function trackOutbound(productId: string, linkId?: string): void {
  track({ kind: "click", productId, linkId });
}
