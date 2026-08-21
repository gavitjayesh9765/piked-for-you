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
  size?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  className?: string;
}) {
  const dims = {
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
