"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/cn";

/**
 * The benchmark bar chart the guides are built around.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A CLIENT COMPONENT WHEN EVERY OTHER CHART HERE IS NOT
 *
 * components/admin/analytics/Charts.tsx and admin/pricing/PriceHistoryChart.tsx
 * are inline SVG rendered on the server, and their opening comments argue for
 * that at length. This one breaks the pattern deliberately, and the reason is
 * the axis rather than the rendering.
 *
 * Those charts plot ONE series against time. This one plots one set of things
 * against several incompatible measures — single-core against multi-core,
 * price against performance — where the whole point of the article is that the
 * ranking CHANGES depending on which you pick. A phone chip that leads on
 * single-core sits fourth on multi-core, and the reader understanding that is
 * the entire argument of the piece.
 *
 * Rendering three static charts stacked would make the same data available and
 * would not make that point, because nobody compares two orderings by scrolling
 * between them. Watching the bars physically overtake each other when you
 * switch measures IS the argument, delivered in one gesture.
 *
 * That is the bar it had to clear to justify shipping JavaScript for a chart,
 * and it is the only chart on the site that clears it.
 *
 * ---------------------------------------------------------------------------
 * HOW THE REORDER ANIMATION WORKS, AND WHY IT IS NOT A LIBRARY
 *
 * Rows are rendered in a FIXED DOM ORDER — always the order they were passed
 * in — and positioned by `transform: translateY()` according to their current
 * rank. Switching measures therefore changes a transform, not the document, so
 * the browser tweens the movement for free with one CSS transition and React
 * never reconciles a reordered list.
 *
 * This is the cheap 90% of a FLIP animation, available here because every row
 * is the same known height. A layout library would do the general case; the
 * general case is not needed and would cost more than everything else in this
 * article combined.
 *
 * ⚠ THE FIXED HEIGHT IS LOAD-BEARING. `--gc-row` sets both the container height
 * and the per-row offset. If a row is ever allowed to grow — a wrapping label,
 * a second line of metadata — rows will overlap. Labels truncate for exactly
 * this reason, and the full text stays reachable via `title`.
 */

export type ChartMetric = {
  /** Key into each row's `values`. */
  id: string;
  /** Button label. Keep it to one or two words — these sit in a segmented control. */
  label: string;
  /**
   * What the number IS, shown above the chart while this measure is active.
   * Written as a full clause: readers arrive at a chart mid-scroll with no idea
   * what "2,900" is meant to be.
   */
  caption: string;
  /** Appended to the value in the sr-only table, e.g. "points", "fps". */
  unit: string;
};

export type ChartRow = {
  id: string;
  /** The thing being measured, e.g. "Snapdragon 8 Elite". */
  label: string;
  /** Who makes it. Rendered small under the label. */
  sublabel?: string;
  /** One value per metric id. A missing key drops the row from that measure. */
  values: Record<string, number | undefined>;
  /**
   * Draw this row in the retail accent rather than the brand one.
   *
   * Used to mark the value pick in a field of flagships — the row the article
   * is arguing for. At most one or two per chart: an accent that appears on
   * half the rows is not an accent, it is a second default.
   */
  emphasis?: boolean;
};

/**
 * Grouped digits, always. A four-digit benchmark score without a separator
 * ("9700") is read as a price by anyone skimming, and these charts sit in
 * articles that also discuss prices in rupees.
 */
const nf = new Intl.NumberFormat("en-IN");

export function BarChart({
  /** Sits above the chart in the tracked label style. */
  title,
  metrics,
  rows,
  /** Where the numbers came from. Non-negotiable — see the note in the JSX. */
  source,
  /**
   * ISO date these figures were last checked against the source.
   *
   * Rendered, not hidden. A benchmark table is a claim with a shelf life, and
   * an undated one invites a reader to assume it is current forever.
   */
  verified,
  /** Set when a LOWER number is better (price, latency). Flips the ranking. */
  lowerIsBetter = false,
  className,
}: {
  title: string;
  metrics: ChartMetric[];
  rows: ChartRow[];
  source: string;
  verified: string;
  lowerIsBetter?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(metrics[0]?.id ?? "");

  /**
   * Bars grow from zero on mount rather than appearing at full width.
   *
   * Not decoration: the growth is what tells a reader arriving mid-scroll that
   * the lengths are the data. A static bar chart is often skimmed as a
   * decorative block and skipped entirely.
   *
   * It is a state flip and not a CSS keyframe animation because the same
   * transition then serves the measure switch, so there is one timing curve in
   * play instead of two that would have to be kept in agreement.
   */
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    // Two frames: one for React to commit width 0, one for the browser to paint
    // it. Committing both widths inside a single frame is indistinguishable
    // from never having set the first, and the bars snap.
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(raf);
  }, []);

  const metric = metrics.find((m) => m.id === active) ?? metrics[0];

  /**
   * Rank and scale for the active measure.
   *
   * Rows with no value for this measure are ranked last and drawn as an empty
   * track rather than dropped. Dropping them would change the chart's height
   * between measures, which — given the fixed-height positioning above — is the
   * one thing guaranteed to make the reorder animation look broken. It is also
   * more honest: "we have no figure for this" is information, and a row that
   * silently vanishes reads as a row that scored zero.
   */
  const { ranks, max } = useMemo(() => {
    const valued = rows
      .map((r) => ({ id: r.id, value: r.values[metric?.id ?? ""] }))
      .filter((r): r is { id: string; value: number } => typeof r.value === "number");

    const sorted = [...valued].sort((a, b) =>
      lowerIsBetter ? a.value - b.value : b.value - a.value,
    );

    const ranks = new Map<string, number>();
    sorted.forEach((r, i) => ranks.set(r.id, i));

    // Unvalued rows keep their input order, parked below everything ranked.
    let next = sorted.length;
    for (const r of rows) if (!ranks.has(r.id)) ranks.set(r.id, next++);

    return { ranks, max: Math.max(...valued.map((r) => r.value), 1) };
  }, [rows, metric?.id, lowerIsBetter]);

  return (
    <figure
      className={cn(
        "not-prose my-10 overflow-hidden rounded-lg border border-line bg-surface-0",
        className,
      )}
    >
      {/*
        The visual chart and its controls are removed from the accessibility
        tree WHOLESALE, and the sr-only table below is the accessible
        representation instead.

        This is a stronger move than the usual `role="img"` plus a label, and it
        is the right one here because the chart is INTERACTIVE. A screen-reader
        user who can reach the measure buttons but not perceive the bars is
        being offered a control with no observable effect, which is worse than
        no control. `inert` (React 19) removes them from focus order too — the
        half that `aria-hidden` alone gets wrong, leaving buttons that are
        invisible to the reader and still tab-stops.

        The table underneath carries EVERY measure at once, so nothing is lost:
        the switcher exists to avoid stacking three charts visually, and a table
        has no such constraint.
      */}
      <div aria-hidden="true" inert>
        {/* --- Header: what this is, and the measure switcher ----------- */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
          <p className="t-eyebrow !text-ink">{title}</p>

          {metrics.length > 1 ? (
            <div
              className="flex shrink-0 gap-1 rounded-full border border-line bg-surface-1 p-1"
              role="group"
            >
              {metrics.map((m) => {
                const on = m.id === metric?.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setActive(m.id)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 font-label text-label-xs uppercase",
                      "tracking-[0.12em] transition-all duration-base ease-ease",
                      on
                        ? "bg-brand-fill text-brand-on shadow-e1"
                        : "text-ink-subtle hover:text-ink",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {/* --- The measure's own caption -------------------------------- */}
        <p className="border-b border-line-faint px-5 py-3 text-body-sm text-ink-muted">
          {metric?.caption}
        </p>

        {/* --- Bars ------------------------------------------------------
            Two-line rows on narrow screens, one line from `sm` up. The row
            height is a custom property because it is needed in three places
            (container height, row offset, and the transition) and a magic
            number in three places is a magic number that will disagree. */}
        <div
          className="relative px-5 py-5 [--gc-row:4.25rem] sm:[--gc-row:3rem]"
          style={{ height: `calc(${rows.length} * var(--gc-row) + 2.5rem)` }}
        >
          {rows.map((row) => {
            const value = row.values[metric?.id ?? ""];
            const rank = ranks.get(row.id) ?? 0;
            const pct = typeof value === "number" ? (value / max) * 100 : 0;

            return (
              <div
                key={row.id}
                className={cn(
                  "absolute inset-x-5 top-5 grid h-[var(--gc-row)] items-center",
                  "grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-3",
                  "sm:grid-cols-[1.5rem_minmax(7rem,11rem)_minmax(0,1fr)_4.5rem]",
                  "transition-transform duration-slow ease-ease motion-reduce:transition-none",
                )}
                style={{ transform: `translateY(calc(${rank} * var(--gc-row)))` }}
              >
                {/* Rank. Recomputed per measure, which is the point — a chip
                    that is 01 on one tab and 04 on the next is the article's
                    thesis rendered as two characters. */}
                <span
                  className={cn(
                    "tabular self-start pt-0.5 text-label-xs tracking-[0.1em] sm:self-center sm:pt-0",
                    rank === 0 ? "text-brand" : "text-ink-faint",
                  )}
                >
                  {typeof value === "number" ? String(rank + 1).padStart(2, "0") : "--"}
                </span>

                {/* Name + maker */}
                <div className="min-w-0 self-start sm:self-center">
                  <p className="truncate text-body-sm font-medium text-ink" title={row.label}>
                    {row.label}
                  </p>
                  {row.sublabel ? (
                    <p className="truncate font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                      {row.sublabel}
                    </p>
                  ) : null}
                </div>

                {/*
                  Value BEFORE the bar in the DOM, which looks wrong and is what
                  makes the narrow layout work.

                  On a phone the row is two lines: rank, name and value across
                  the top, bar spanning the full width beneath. A grid places
                  items in DOM order, so a full-width bar declared before the
                  value pushes the value onto a THIRD line — which is what this
                  did, and it made every row overflow its fixed height and
                  collide with the row below.

                  Reading order is the right order too: on a phone you want the
                  number next to the name, not stranded under a bar.

                  From `sm` up the row is one line and the visual order is
                  bar-then-value, restored by explicit column placement rather
                  than by `order`, so the two elements stay in their real grid
                  cells and the tabular value column still lines up.
                */}
                <span
                  className={cn(
                    "tabular self-start text-right text-body-sm sm:col-start-4 sm:row-start-1 sm:self-center",
                    row.emphasis ? "text-retail" : "text-ink",
                  )}
                >
                  {typeof value === "number" ? nf.format(value) : "—"}
                </span>

                {/*
                  Track + fill.

                  `mb-3` on the narrow layout only, and it is doing legibility
                  work rather than spacing work. `self-end` puts the bar flush
                  against the bottom of its row, which leaves it equidistant
                  between its OWN name above and the NEXT row's name below —
                  and a reader then has to count to work out which bar belongs
                  to which chip. Lifting it clear of the row boundary binds it
                  visually to the name it describes.
                */}
                <div
                  className="col-span-3 mb-3 h-2.5 self-end rounded-full bg-surface-2
                             sm:col-span-1 sm:col-start-3 sm:row-start-1 sm:mb-0 sm:self-center"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-slow ease-ease",
                      "motion-reduce:transition-none",
                      row.emphasis
                        ? "bg-gradient-to-r from-retail-fill to-retail-vivid"
                        : "bg-gradient-to-r from-brand-fill to-brand-vivid",
                    )}
                    style={{ width: grown ? `${pct}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* --- Provenance -------------------------------------------------
          Rendered, never omitted, and deliberately not collapsed behind a
          disclosure. This site's whole proposition is that its numbers can be
          checked; a chart whose source is a tooltip is asking to be trusted
          rather than verified. It is also the block that stops an answer engine
          citing these figures as ours when they are somebody else's. */}
      <figcaption className="border-t border-line bg-surface-1 px-5 py-3">
        <p className="text-body-sm text-ink-subtle">
          <span className="font-medium text-ink-muted">
            {lowerIsBetter ? "Lower is better." : "Higher is better."}
          </span>{" "}
          Source: {source}. Figures last checked {verified}.
        </p>
      </figcaption>

      {/* --- The accessible copy of the same data ----------------------- */}
      <table className="sr-only">
        <caption>
          {title}. {metric?.caption}
        </caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            {metrics.map((m) => (
              <th key={m.id} scope="col">
                {m.label} ({m.unit})
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <th scope="row">
                {row.label}
                {row.sublabel ? `, ${row.sublabel}` : ""}
              </th>
              {metrics.map((m) => {
                const v = row.values[m.id];
                return (
                  <td key={m.id}>{typeof v === "number" ? `${nf.format(v)} ${m.unit}` : "no figure"}</td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
