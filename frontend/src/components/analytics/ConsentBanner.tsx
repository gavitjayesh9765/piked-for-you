"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { readAnalyticsChoice, setAnalyticsConsent } from "@/lib/analytics";

/**
 * The analytics consent bar.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS, WHEN THE SITE SPENT ITS WHOLE LIFE NOT NEEDING ONE
 *
 * It did not need one, and the reason is written into `lib/track.ts`: the
 * first-party counters carry no identifier of any kind, so there was nothing
 * to ask permission for. That is still true, and those counters still run for
 * everyone regardless of anything decided here.
 *
 * Google Analytics is the thing that changed. It boots with Consent Mode v2 and
 * `analytics_storage: denied` — cookieless, and honest — but there is a fact
 * about GA4 that makes "denied by default, with no way to say yes" a dead end:
 *
 *   ⚠ GA4 DOES NOT REPORT CONSENT-DENIED TRAFFIC. Cookieless pings do not
 *     appear in Realtime and do not appear in standard reports. They feed
 *     *behavioural modelling*, and modelling only switches on once a property
 *     sustains volume thresholds — which a property collecting nothing else
 *     never reaches. So the tag was installed, correct, firing on every page,
 *     and the dashboard read zero. Not a bug in the tag. A consequence of
 *     never asking.
 *
 * So this asks. Once, in a bar, with a real "No" that is remembered.
 *
 * ---------------------------------------------------------------------------
 * WHAT MAKES THIS NOT A DARK PATTERN, SPECIFICALLY
 *
 * These are commitments, not styling preferences. Each one is easy to erode by
 * accident later, so each is written down:
 *
 *   - Both buttons are the SAME SIZE and both are one click. Declining is not
 *     hidden behind "Manage preferences", because there is exactly one thing to
 *     decide and a second screen would exist only to make No expensive.
 *   - Nothing is pre-consented. Until the reader answers, GA stays denied — the
 *     bar is not gating something already switched on.
 *   - Dismissing IS declining. There is no X that leaves the question open so
 *     the bar can ask again tomorrow.
 *   - The answer is remembered in all three states (see `readAnalyticsChoice`),
 *     so "No" is not re-litigated on the next page.
 *   - No content is blocked, no overlay, no scroll lock. The site works
 *     identically whether this is answered or ignored forever.
 *
 * ---------------------------------------------------------------------------
 * WHY IT RENDERS NOTHING UNTIL AFTER MOUNT
 *
 * The answer lives in `localStorage`, which the server cannot read. Rendering
 * the bar on the server would show it to everyone including the people who
 * already declined, then tear it out on hydration — a flash of a consent
 * prompt that has already been answered, on every single page load. So the
 * first client render matches the server's (nothing) and the bar appears only
 * once the answer has been read and found missing.
 */
export function ConsentBanner() {
  // `null` = not yet read. Distinct from "read it, and there was no answer",
  // which is what actually opens the bar.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(readAnalyticsChoice() === null);
  }, []);

  if (!visible) return null;

  function answer(granted: boolean) {
    // Writes the answer AND pushes it into Consent Mode in the same call, so a
    // reader who accepts is measured from this moment rather than from their
    // next page load. See lib/analytics.ts.
    setAnalyticsConsent(granted);
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Analytics choice"
      /* Above the comparison shelf, which is `z-sticky` and can be open at the
         same time. Also flagged as an obstacle so the BackToTop dial lifts over
         it instead of sitting on the buttons — see the DOCKING note in
         components/layout/BackToTop.tsx, which rescans for this attribute. */
      data-dock-obstacle
      /* OPAQUE, not `glass-top` like the comparison shelf.
         That class is a 0.72-alpha backdrop blur, which is right for a slim bar
         you read past — and wrong here. This bar is tall enough on a phone to
         cover the homepage stat row, and the blur left "340+ PRODUCTS
         RESEARCHED" legible straight through the question, so neither the
         question nor the page underneath could be read. A consent prompt is the
         one thing on the page that must be unambiguous. */
      className="fixed inset-x-0 bottom-0 z-overlay border-t border-line
                 bg-surface-0 shadow-e3"
    >
      <div
        className="shell flex flex-col gap-4 py-4
                   sm:flex-row sm:items-center sm:justify-between sm:gap-6"
      >
        {/* Deliberately short. The first draft ran four sentences and stood
            211px tall on a 390px screen — a third of the viewport, to ask one
            question. Everything cut from here is on /cookies, one tap away. */}
        <p className="max-w-prose text-body-sm text-ink-muted">
          <span className="text-ink">Count this visit with Google Analytics?</span> It sets a
          cookie so we can tell returning readers from new ones. Decline and we still count
          the page, with nothing stored in your browser.{" "}
          <Link
            href="/cookies"
            className="text-brand underline decoration-brand-line underline-offset-4
                       transition-colors duration-fast hover:decoration-brand"
          >
            What this sets
          </Link>
          .
        </p>

        {/* Same size, same row, same weight of decision. Decline is first in
            DOM order so a keyboard reader reaches "No" without tabbing past
            "Yes" — the cheap version of this puts Accept first and lets muscle
            memory do the rest. */}
        <div className="flex shrink-0 gap-3">
          <Button variant="outline" size="sm" onClick={() => answer(false)}>
            No thanks
          </Button>
          <Button variant="brand" size="sm" onClick={() => answer(true)}>
            Yes, that&rsquo;s fine
          </Button>
        </div>
      </div>
    </div>
  );
}
