import Link from "next/link";

import { formatDate, formatPrice } from "@/lib/format";
import type { PriceTrail as Trail } from "@/lib/types";

/**
 * What we have actually seen this price do.
 *
 * ---------------------------------------------------------------------------
 * WHY THERE IS NO LINE CHART HERE
 *
 * Every price-history feature on the internet is a line chart, and a line chart
 * would be the wrong drawing of this data twice over.
 *
 * Prices on this site are never checked on a timer. A run exists because an
 * admin pressed the button — that is a stated non-negotiable, not a gap waiting
 * to be filled — so the observations are irregular in time. And a history row
 * is written only when the number MOVED, so they are sparse as well. A line
 * between two of those points would draw a price on every day in between: days
 * nobody looked, at a figure nobody recorded. It would be a picture of
 * continuous monitoring we deliberately do not do.
 *
 * The rail below claims only what the rows support — these were the extremes,
 * this is where it sits between them, this is how many times it moved. It reads
 * in about a second, which a chart of eleven irregular points does not, and
 * every pixel of it is something we observed.
 *
 * ---------------------------------------------------------------------------
 * WHY THE WINDOW IS NOT THE ALL-TIME RANGE
 *
 * The card already prints `pricing.min`–`pricing.max`, and those are all-time
 * and only ever widen (see `_roll_up_product_price`). A floor touched once,
 * eighteen months ago, is not a fact anyone can act on; it just makes every
 * present price look expensive. This block is bounded so "lowest in 90 days"
 * means exactly that.
 */
export function PriceTrail({ trail }: { trail: Trail }) {
  const { currency, windowDays, changes, current, low, high, lastChangedAt } = trail;

  // Nothing observed and nothing remembered: say nothing. An empty state here
  // would be a block announcing that we have no information, which is worse
  // than the reader never asking.
  if (!lastChangedAt && changes === 0) return null;

  const hasRange = low != null && high != null && high.amount > low.amount && current != null;

  if (!hasRange) return <Unchanged since={lastChangedAt} windowDays={windowDays} changes={changes} />;

  const span = high.amount - low.amount;
  // Clamped, because `current` is the cheapest ACTIVE retailer link while the
  // extremes come from recorded movements at any retailer. A link that has not
  // moved inside the window can leave the live price below everything the
  // window saw — which is a real state, not a bug, and the marker should sit at
  // the floor rather than off the end of the rail.
  const position = Math.min(1, Math.max(0, (current - low.amount) / span));
  const atFloor = current <= low.amount;
  const above = current - low.amount;

  return (
    <section aria-label="Observed price range" className="mt-7 border-t border-line pt-7 sm:mt-8 sm:pt-8">
      <p className="t-eyebrow">Observed price · last {windowDays} days</p>

      {/* --- The rail ---
          A track, two ends, one marker. `tabular` on both figures so the ends
          keep their positions when a price gains a digit. */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="tabular text-body-sm font-semibold text-ink">
            {formatPrice(low.amount, currency)}
          </span>
          <span className="tabular text-body-sm text-ink-subtle">
            {formatPrice(high.amount, currency)}
          </span>
        </div>

        <div className="relative mt-2 h-6">
          {/* The track sits on the vertical centre so the marker can straddle
              it without the row's height depending on the marker's size. */}
          <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line-strong" />

          {/* Ticks at both ends — the range is a closed interval, and a bare
              line reads as an axis that continues past what we know. */}
          <div className="absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-line-strong" />
          <div className="absolute right-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-line-strong" />

          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${position * 100}%` }}
          >
            {/* Green only at the floor. Green is the VALUE role in this palette
                (docs/02-design-system.md §2) and "as cheap as we have seen it"
                is precisely a value signal; anywhere else on the rail it would
                be colouring an ordinary price as a good one. */}
            <span
              className={[
                "block h-3 w-3 rounded-full ring-4",
                atFloor
                  ? "bg-value ring-value-soft"
                  : "bg-ink ring-surface-0",
              ].join(" ")}
            />
          </div>
        </div>
      </div>

      {/* --- What it means --- */}
      <p className="mt-4 text-body-md text-ink">
        {atFloor ? (
          <>
            <span className="text-value">Lowest we have recorded</span> in this window.
          </>
        ) : (
          <>
            {formatPrice(above, currency)} above the lowest we have recorded
            {low.at ? <> — last seen there on {formatDate(low.at)}</> : null}.
          </>
        )}
      </p>

      <p className="mt-2 text-body-sm text-ink-subtle">
        {/* "Changes", never "checks". History is written only when the figure
            moves, so a price checked forty times and stable throughout has no
            rows at all — calling these checks would claim a cadence we do not
            have. */}
        {changes === 1 ? "One price change" : `${changes} price changes`} recorded.{" "}
        <PriceMethodNote />
      </p>
    </section>
  );
}

/**
 * The window is empty, but the log is not.
 *
 * This is the state a chart cannot render and would therefore hide: no
 * movement, nothing to plot, block disappears. But "this price has not moved
 * since February" is a real answer to "should I wait for a sale", and it is
 * only sayable because the history is append-only — the last change is still
 * there to be found however long ago it was.
 */
function Unchanged({
  since,
  windowDays,
  changes,
}: {
  since?: string | null;
  windowDays: number;
  changes: number;
}) {
  if (!since) return null;

  return (
    <section aria-label="Observed price range" className="mt-7 border-t border-line pt-7 sm:mt-8 sm:pt-8">
      <p className="t-eyebrow">Observed price</p>
      <p className="mt-4 text-body-md text-ink">
        This price has not moved since {formatDate(since)}.
      </p>
      <p className="mt-2 text-body-sm text-ink-subtle">
        {/* Only when the window really is empty. This branch also catches the
            case of exactly one movement INSIDE the window — one row gives a
            low equal to its high, so there is no range to draw — and there
            "no change in the last 90 days" would be flatly untrue, since the
            date printed directly above it is inside those 90 days. */}
        {changes === 0 ? <>No change in the last {windowDays} days. </> : null}
        <PriceMethodNote />
      </p>
    </section>
  );
}

/**
 * The sentence that keeps the whole block honest.
 *
 * Without it, a reader reasonably assumes these numbers come from continuous
 * tracking, because everywhere else that shows them does. Saying how the data
 * is gathered is what earns the right to show it at all — and it is a claim the
 * site can make and its competitors mostly cannot.
 */
function PriceMethodNote() {
  return (
    <>
      We check prices by hand, not on a timer —{" "}
      <Link
        href="/how-we-research"
        className="underline decoration-line-strong underline-offset-4
                   transition-colors duration-fast hover:text-ink hover:decoration-ink"
      >
        how we research
      </Link>
      .
    </>
  );
}
