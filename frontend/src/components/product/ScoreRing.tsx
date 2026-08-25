import { cn } from "@/lib/cn";

/**
 * The PickD Score ring — the single most branded object in the product.
 * Purple arc, Geist Mono numeral, tabular figures.
 *
 * This is OUR evaluation (0–10, spec §24). It is never rendered anywhere near
 * a community star rating without a label distinguishing the two — merging the
 * two signals is the trust failure called out in spec §32.
 */
export function ScoreRing({
  score,
  size = "md",
  showLabel = true,
  className,
}: {
  /** 0–10 */
  score: number;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  className?: string;
}) {
  const dims = {
    // `xs` exists for the two-up product grid on a phone, where the ring rides
    // in the corner of a ~155px plate rather than in a header row.
    xs: { box: 34, stroke: 3, text: "text-[11px]" },
    sm: { box: 40, stroke: 3, text: "text-[13px]" },
    md: { box: 56, stroke: 3, text: "text-[17px]" },
    lg: { box: 76, stroke: 3.5, text: "text-[24px]" },
    xl: { box: 104, stroke: 4, text: "text-[34px]" },
  }[size];

  // Coerced at the boundary: money and score values cross the wire from a
  // NUMERIC column, and a stringy value must degrade to 0 rather than
  // throwing inside a Server Component and 500-ing the whole page.
  const n = typeof score === "number" ? score : Number(score);
  const clamped = Math.max(0, Math.min(10, Number.isFinite(n) ? n : 0));
  // r=15.5 on a 36-unit viewBox gives a circumference of ~97.4, close enough to
  // 100 that a 0–100 dasharray reads as a direct percentage.
  const pct = (clamped / 10) * 100;

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div
        className="relative grid place-items-center rounded-full bg-surface-0 border border-line"
        style={{ width: dims.box, height: dims.box }}
        role="img"
        aria-label={`PickD Score ${clamped.toFixed(1)} out of 10`}
      >
        <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" width={dims.box} height={dims.box}>
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="var(--c-score-track)"
            strokeWidth={dims.stroke}
          />
          <circle
            className="ring-arc"
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="var(--c-brand-vivid)"
            strokeWidth={dims.stroke}
            strokeLinecap="round"
            strokeDasharray="100"
            strokeDashoffset={100 - pct}
            pathLength={100}
          />
        </svg>
        <span className={cn("tabular font-semibold text-ink relative z-10", dims.text)}>
          {clamped.toFixed(1)}
        </span>
      </div>
      {showLabel && (
        <span className="t-eyebrow text-[9px] leading-none">PickD Score</span>
      )}
    </div>
  );
}

/**
 * Per-criterion breakdown (spec §24). Criteria come from the category's scoring
 * config, so this component never knows what "Sound" or "Refresh rate" means —
 * it just renders whatever the API sends.
 */
export function ScoreBreakdown({
  criteria,
  className,
}: {
  criteria: { key: string; label: string; value: number }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-3", className)}>
      {criteria.map((c) => (
        <div key={c.key} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5">
          <dt className="t-label text-ink-muted normal-case tracking-[0.04em]">{c.label}</dt>
          <dd className="tabular text-body-sm font-semibold text-ink">{(Number(c.value) || 0).toFixed(1)}</dd>
          <div className="col-span-2 h-1 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full bg-brand-vivid transition-[width] duration-slow ease-ease"
              style={{ width: `${(Math.max(0, Math.min(10, Number(c.value) || 0)) / 10) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}

/**
 * The score, as a section of its own (spec §24).
 *
 * The ring used to sit in the hero with its criteria stacked underneath it, in
 * a column narrow enough that five criteria became five nearly-full-width bars
 * — a shape that read as a loading skeleton. Given the page's own width the
 * criteria lay out in two columns, the ring keeps the scale beside it, and the
 * whole thing becomes something a reader can compare against another product's
 * rather than a decorative stack.
 *
 * The ring stays in the hero too. That is not duplication: up there it is a
 * glance value, and here it is the label on a breakdown.
 */
export function ScorePanel({
  overall,
  criteria,
  updatedAt,
  className,
  id = "score",
}: {
  overall: number;
  criteria: { key: string; label: string; value: number; weight?: number }[];
  updatedAt?: string;
  className?: string;
  id?: string;
}) {
  const n = Number(overall) || 0;

  return (
    <section
      id={id}
      aria-labelledby="score-heading"
      className={cn("panel p-6 sm:p-8", className)}
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-12">
        <div>
          <h2 id="score-heading" className="t-eyebrow text-brand">
            PickD Score
          </h2>

          <div className="mt-5 flex items-center gap-5">
            <ScoreRing score={n} size="xl" showLabel={false} className="shrink-0" />
            <div className="min-w-0">
              <p className="tabular text-headline-md font-bold leading-none text-ink">
                {n.toFixed(1)}
                <span className="text-body-md font-normal text-ink-subtle"> / 10</span>
              </p>
              {/* Named rather than left as a bare number: "7.4" means nothing
                  until a reader knows whether that is good. */}
              <p className="mt-2 text-body-sm text-ink-muted">{scoreBand(n)}</p>
            </div>
          </div>

          <p className="mt-5 text-body-sm leading-relaxed text-ink-muted">
            Ours, and measured against this category&apos;s rubric — never against the other
            products in a round-up. It is never merged with the community rating.
          </p>
        </div>

        {criteria.length > 0 && (
          <div>
            <h3 className="t-eyebrow border-b border-line pb-3">What makes it up</h3>
            <ScoreBreakdown criteria={criteria} className="mt-5 sm:grid-cols-2 sm:gap-x-8" />
            {updatedAt && (
              <p className="tabular mt-6 font-mono text-label-xs uppercase tracking-[0.14em] text-ink-faint">
                Scored {new Date(updatedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * A word for a number. The bands are deliberately blunt — a scale where
 * everything lands in "very good" is a scale that has stopped measuring.
 */
function scoreBand(n: number): string {
  if (n >= 9) return "Exceptional — among the best we have researched.";
  if (n >= 8) return "Very good. Few real compromises at this price.";
  if (n >= 7) return "Good, with trade-offs worth knowing about.";
  if (n >= 6) return "Fair. Competent, but beaten in this price band.";
  if (n >= 4) return "Weak. Something else is a better use of the money.";
  return "Poor. We would not spend our own money here.";
}
