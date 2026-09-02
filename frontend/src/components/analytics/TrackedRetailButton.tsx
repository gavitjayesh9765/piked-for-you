"use client";

import type { ComponentProps } from "react";

import { RetailButton } from "@/components/ui/Button";
import { trackOutbound } from "@/lib/track";
import { gaEvent } from "@/lib/analytics";

/**
 * <RetailButton> with an outbound click counted.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A WRAPPER AND NOT A PROP ON RetailButton
 *
 * The obvious change was to add an `onClick` to `RetailButton` itself. That
 * requires `"use client"` at the top of `components/ui/Button.tsx` — and that
 * file also exports `Button` and `ButtonLink`, which are used on almost every
 * server-rendered page in the site. One prop would have moved the whole button
 * system into the client bundle to count a click on one of its variants.
 *
 * So the click handler lives out here, on a wrapper, and `Button.tsx` stays a
 * server component.
 *
 * ---------------------------------------------------------------------------
 * WHY THE HANDLER IS ON A <span>, WHICH LOOKS LIKE AN ACCESSIBILITY MISTAKE
 *
 * It is not one, because the span never becomes interactive: no `role`, no
 * `tabIndex`, no keyboard handler. The only focusable, activatable thing here
 * is the anchor `RetailButton` already renders, with its `rel="sponsored
 * noopener noreferrer"` intact. This span exists solely to catch the click
 * event as it bubbles up from that anchor.
 *
 * That also covers keyboard activation for free — pressing Enter on a focused
 * link dispatches a real click event, which bubbles the same way a pointer
 * click does.
 *
 * `display: contents` removes the span from the layout entirely, so the button
 * sits in its parent flex/grid exactly as it did before this wrapper existed.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS MUST NEVER DO
 *
 * It must never call `preventDefault()`, never `await` anything, and never
 * redirect through a counting endpoint of our own. A reader who clicks "View
 * on Amazon" goes to Amazon immediately, whether the beacon succeeds, fails,
 * or is blocked by an extension. The number is worth having; it is not worth
 * one millisecond of a reader's time or one chance in a thousand of a dead
 * link.
 */
export function TrackedRetailButton({
  productId,
  linkId,
  ...props
}: ComponentProps<typeof RetailButton> & {
  productId: string;
  /** The `product_retailers` row id. Absent for a button with no link row
   *  behind it — the product-level click is still counted, it just is not
   *  attributed to a shop. */
  linkId?: string;
}) {
  return (
    <span
      style={{ display: "contents" }}
      onClick={() => {
        /**
         * TWO CALLS, TWO SYSTEMS, ON PURPOSE.
         *
         * `trackOutbound` is the first-party beacon — anonymous, posted to our
         * own API, and the source the admin Analytics screen reads. `gaEvent`
         * is Google's. They are deliberately NOT chained: `lib/track.ts` says
         * in its header exactly what its payload may contain and that one
         * extra field ends the property that lets this site count traffic
         * without a banner, so nothing about GA belongs inside it.
         *
         * Both are fire-and-forget and neither may delay the navigation. See
         * the note below on what this handler must never do — it applies to
         * both calls equally.
         */
        trackOutbound(productId, linkId);
        gaEvent("outbound_click", {
          product_id: productId,
          // The `product_retailers` row, when the button has one behind it.
          // Absent is normal, not an error — see the prop's own comment.
          link_id: linkId,
          // GA's own recommended parameter name for a link leaving the site.
          // Populated from the anchor rather than assumed, so a button whose
          // href changes shape does not quietly start reporting the wrong host.
          link_url: props.href,
        });
      }}
    >
      <RetailButton {...props} />
    </span>
  );
}
