/**
 * The tracking beacon, client side.
 *
 * Posts to `POST {API_URL}/track`, which answers 204 to everything. See
 * `backend/app/modules/analytics/router.py` for what happens on the other end
 * and `supabase/migrations/20260827180440_analytics_daily.sql` for why the
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

import { API_URL } from "@/lib/env";

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

export function track(payload: TrackPayload): void {
  // No API configured (a mock build, or a misconfigured preview) means there
  // is nowhere to send this. Not an error — just nothing to do.
  if (!API_URL || typeof window === "undefined") return;

  const url = `${API_URL}/track`;
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
     * ⚠ `application/json` makes this a NON-SIMPLE cross-origin request, so it
     * is preflighted. The API's CORS middleware already allows the site's
     * origin, so this works — but it does mean each beacon is two round trips,
     * and it is the reason a `text/plain` body would be tempting. Don't: a
     * preflight the browser caches beats a 422 nobody can see.
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
    mode: "cors",
    credentials: "omit",
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
