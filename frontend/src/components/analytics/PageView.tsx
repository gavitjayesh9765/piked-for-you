"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { track } from "@/lib/track";

/**
 * The two view beacons. Both render nothing.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE ARE TWO OF THESE AND NOT ONE
 *
 * They count different things and they mount in different places.
 *
 *   <PageView/>    lives in the public site layout and fires on every route,
 *                  carrying a path and no product. It is what makes the
 *                  homepage, the category indexes and the trust pages
 *                  countable at all.
 *
 *   <ProductView/> lives on the product page and fires with a product id and
 *                  NO path. It is what attributes a view to a specific product.
 *
 * A product page therefore fires both, and they do not overlap: the server
 * bumps the path dimension only when it is given a path, and the product
 * counter only when it is given a product. Sending a path from <ProductView/>
 * would double-count every product page in the path table; sending a product
 * id from <PageView/> is impossible, since the layout does not know one.
 *
 * ---------------------------------------------------------------------------
 * WHY THE LAYOUT IS THE RIGHT PLACE FOR <PageView/>
 *
 * The site layout survives client-side navigation — that is the whole reason
 * it exists (see the comment in app/(site)/layout.tsx). So this component
 * mounts once for the reader's entire session and is NOT remounted per route,
 * which is precisely why it watches `usePathname()` rather than firing on
 * mount: an effect with an empty dependency array here would count the first
 * page a reader landed on and then nothing else, for as long as they stayed.
 */
export function PageView() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;

    /**
     * ⚠ THE GUARD IS NOT A MICRO-OPTIMISATION.
     *
     * This effect re-runs whenever React re-renders it with a changed
     * dependency, and in development `StrictMode` deliberately double-invokes
     * effects to surface exactly this class of bug. Without the guard every
     * view is counted twice in dev and, more importantly, any future change
     * that adds a dependency here silently doubles production numbers with no
     * visible symptom — the counters would just be wrong, and wrong in a
     * direction that looks like growth.
     */
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    track({
      kind: "view",
      path: pathname,
      // Only meaningful on the first page of a visit; on client-side
      // navigation the browser leaves it as the original external referrer,
      // which is the value we actually want. Same-site referrers are dropped
      // server-side, so an internal one costs a row nobody counts.
      referrer: document.referrer || undefined,
    });
  }, [pathname]);

  return null;
}

/**
 * A view of one product. Mounted by the product page, alongside the layout's
 * <PageView/>.
 *
 * Fires on `productId` rather than on mount for the same reason as above: a
 * reader moving from one product to another is a client-side navigation, and
 * the page component may be reused with new props rather than remounted.
 */
export function ProductView({ productId }: { productId: string }) {
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!productId || lastSent.current === productId) return;
    lastSent.current = productId;

    track({ kind: "view", productId });
  }, [productId]);

  return null;
}
