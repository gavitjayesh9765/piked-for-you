"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  ANALYTICS_CONSENT_EVENT,
  applyAnalyticsConsent,
  readAnalyticsConsent,
} from "@/lib/analytics";

/**
 * Sends GA `page_view` events, and keeps Consent Mode in step with the reader.
 *
 * Renders nothing. Mounted by `GoogleAnalytics`, which mounts on the site
 * layout — the boundary that SURVIVES a client-side navigation, which is the
 * whole reason this watches the URL rather than firing on mount. See the long
 * note in `PageView.tsx`; the reasoning is identical and worth reading once.
 *
 * ⚠ This is the GA path only. `PageView` next to it is the first-party
 * counter, it fires independently, and neither is a fallback for the other.
 * Deleting one does not silently degrade — it just stops that one source.
 */
export function GaRouteViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * Query string included, unlike the first-party beacon, which drops it on
   * purpose. GA aggregates by full URL and is where a question like "which
   * search terms lead somewhere" is actually answerable — our own counters
   * fold the path to a route shape long before it reaches a table.
   */
  const search = searchParams.toString();
  const url = pathname + (search ? `?${search}` : "");

  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    /**
     * ⚠ The same guard as PageView, for the same reason and with the same
     * consequence. StrictMode double-invokes effects in development, and any
     * future dependency added here would double every production number with
     * no visible symptom — the graph would just read as growth.
     */
    if (lastSent.current === url) return;
    lastSent.current = url;

    window.gtag?.("event", "page_view", {
      // Explicit, because gtag would otherwise resolve the location itself and
      // on a client-side navigation it can read the URL we just left.
      page_location: window.location.href,
      page_path: url,
      // page_title is deliberately NOT sent. Next applies a route's <title>
      // around the same commit this effect runs in, so a title read here is
      // sometimes the previous page's. Omitted, gtag reads document.title when
      // the request is actually built, a moment later, which is right more
      // often than a value captured too early.
    });
  }, [pathname, url]);

  /**
   * Cross-tab consent.
   *
   * Changing the toggle updates gtag in the tab it was changed in — that is
   * `setAnalyticsConsent`'s job, and it happens immediately. This handles the
   * OTHER tabs: a reader with the site open twice who withdraws consent in one
   * of them must not keep being measured with a cookie in the other. `storage`
   * fires only in the tabs that did not make the change, which is exactly the
   * set that needs telling.
   */
  useEffect(() => {
    function sync() {
      applyAnalyticsConsent(readAnalyticsConsent());
    }
    window.addEventListener("storage", sync);
    window.addEventListener(ANALYTICS_CONSENT_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, sync);
    };
  }, []);

  return null;
}
