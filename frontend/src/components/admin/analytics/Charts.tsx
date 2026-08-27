import { cn } from "@/lib/cn";
import type { AnalyticsSeriesPoint } from "@/lib/admin-api";

/**
 * The analytics charts, drawn as inline SVG.
 *
 * Same reasoning as `admin/pricing/PriceHistoryChart.tsx`: no charting
 * library. These are a few dozen points and a handful of bars, and a
 * dependency that ships a layout engine to draw them would cost more than the
 * whole feature. Inline SVG also renders inside a Server Component, so the
 * chart arrives in the first HTML response rather than after hydration — which
 * on an admin screen behind a slow API is the difference between a page that
 * looks loaded and one that pops.
 *
 * Every colour is a design token via `var(--c-*)`, so all of this follows the
 * theme without a second palette to keep in step.
 */

/* --------------------------------------------------------------------- */
/* Sparkline                                                              */
/* --------------------------------------------------------------------- */

/**
 * Fourteen days of page views, at tile size.
 *
 * Deliberately has no axes, no labels and no tooltip. At 120x32 there is room
 * for a shape and nothing else, and a shape is the entire question being asked
 * here: is this going up or down. The numbers beside it are the answer to
 * "by how much".
 */
export function Sparkline({
  values,
  className,
}: {
  values: number[];
  className?: string;
}) {
  const w = 120;
  const h = 32;

  // A flat series (all zeroes, or one repeated value) has no shape. Drawing it
  // against a max of 0 divides by zero; drawing it against its own value pins
  // every point to the top, which reads as "maximum traffic" when it means
  // "nothing happened". A flat line along the bottom is the honest picture.
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? w / (values.length - 1) : w;

  const points = values.map((v, i) => {
    const x = i * step;
    // 2px inset top and bottom so the stroke is not clipped by the viewBox.
    const y = h - 2 - (v / max) * (h - 4);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const line = points.join(" ");
  const area = `${0},${h} ${line} ${w},${h}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      className={cn("overflow-visible", className)}
      role="img"
      aria-label={`Page views over the last ${values.length} days`}
      preserveAspectRatio="none"
    >
      <polygon points={area} fill="var(--c-brand-soft)" opacity={0.7} />
      <polyline
        points={line}
        fill="none"
        stroke="var(--c-brand-vivid)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* --------------------------------------------------------------------- */
/* Traffic chart                                                          */
/* --------------------------------------------------------------------- */

const W = 900;
const H = 240;
const PAD = { top: 14, right: 14, bottom: 26, left: 46 };

/**
 * Page views and outbound clicks over the window.
 *
 * ---------------------------------------------------------------------------
 * ⚠ TWO SERIES, ONE AXIS, AND WHY THAT IS NOT A MISTAKE HERE
 *
 * Clicks are typically one to five percent of views, so plotted against a
 * shared axis the click line sits flat along the bottom. The usual fix is a
 * second y-axis with its own scale — and it is the wrong fix for this chart,
 * because a dual axis lets you place two lines at the same height while they
 * mean wildly different numbers, which is exactly the comparison a reader will
 * make by eye and exactly the one that would be false.
 *
 * So clicks keep the shared axis and are drawn as bars rather than a line: a
 * short bar reads as "a small number", which is true, where a flat line reads
 * as "no change", which is not. The CTR tile above the chart is where the
 * ratio is stated properly.
 */
export function TrafficChart({
  series,
  className,
}: {
  series: AnalyticsSeriesPoint[];
  className?: string;
}) {
  if (series.length === 0) {
    return (
      <div className={cn("dot-matrix rounded-md border border-line py-16 text-center", className)}>
        <p className="text-body-sm text-ink-muted">No traffic recorded in this window.</p>
      </div>
    );
  }

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const max = Math.max(...series.map((p) => Math.max(p.pageViews, p.views)), 1);
  // Round the ceiling up to something a person would choose, so the gridline
  // labels read 0 / 25 / 50 rather than 0 / 23 / 46.
  const ceiling = niceCeiling(max);

  const x = (i: number) =>
    PAD.left + (series.length > 1 ? (i / (series.length - 1)) * innerW : innerW / 2);
  const y = (v: number) => PAD.top + innerH - (v / ceiling) * innerH;

  const viewsLine = series.map((p, i) => `${x(i).toFixed(1)},${y(p.pageViews).toFixed(1)}`).join(" ");
  const productLine = series.map((p, i) => `${x(i).toFixed(1)},${y(p.views).toFixed(1)}`).join(" ");

  // Bar width from the point spacing, capped so a 7-day window does not render
  // seven fence posts.
  const barW = Math.min(14, Math.max(2, (innerW / series.length) * 0.36));

  const gridlines = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: Math.round(ceiling * f),
    y: PAD.top + innerH - f * innerH,
  }));

  // First, middle and last only. A tick per day is unreadable at 90 days and
  // redundant at 7 — the shape carries the detail, these carry the range.
  const ticks = [0, Math.floor((series.length - 1) / 2), series.length - 1].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full min-w-[560px]"
        role="img"
        aria-label={`Page views and outbound clicks per day, ${series[0].day} to ${series[series.length - 1].day}`}
      >
        {gridlines.map((g) => (
          <g key={g.value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={g.y}
              y2={g.y}
              stroke="var(--c-line)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={g.y + 3}
              textAnchor="end"
              className="fill-[var(--c-ink-faint)] text-[10px]"
            >
              {g.value}
            </text>
          </g>
        ))}

        {/* Clicks first, so the lines draw over the bars rather than under. */}
        {series.map((p, i) =>
          p.clicks > 0 ? (
            <rect
              key={p.day}
              x={x(i) - barW / 2}
              y={y(p.clicks)}
              width={barW}
              height={Math.max(1, PAD.top + innerH - y(p.clicks))}
              rx={1}
              fill="var(--c-retail-vivid)"
              opacity={0.85}
            />
          ) : null,
        )}

        <polyline
          points={viewsLine}
          fill="none"
          stroke="var(--c-brand-vivid)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <polyline
          points={productLine}
          fill="none"
          stroke="var(--c-value-vivid)"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {ticks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}
            className="fill-[var(--c-ink-faint)] text-[10px]"
          >
            {shortDate(series[i].day)}
          </text>
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 pl-1">
        <Key colour="var(--c-brand-vivid)" label="Page views" />
        <Key colour="var(--c-value-vivid)" label="Product views" dashed />
        <Key colour="var(--c-retail-vivid)" label="Outbound clicks" bar />
      </div>
    </div>
  );
}

function Key({
  colour,
  label,
  dashed,
  bar,
}: {
  colour: string;
  label: string;
  dashed?: boolean;
  bar?: boolean;
}) {
  return (
    <span className="flex items-center gap-2 font-label text-[10px] uppercase tracking-[0.12em] text-ink-faint">
      {bar ? (
        <span className="h-3 w-2 rounded-[1px]" style={{ backgroundColor: colour }} />
      ) : (
        <span
          className="h-0 w-5 border-t-2"
          style={{ borderColor: colour, borderStyle: dashed ? "dashed" : "solid" }}
        />
      )}
      {label}
    </span>
  );
}

/* --------------------------------------------------------------------- */
/* Horizontal bar list                                                    */
/* --------------------------------------------------------------------- */

/**
 * A ranked list with a proportional bar behind each row — for paths,
 * referrers, devices and retailers.
 *
 * Bars are scaled against the LARGEST ROW, not against the total. Against the
 * total, a well-distributed list renders as ten near-invisible slivers and the
 * ranking becomes unreadable; against the maximum, the top row is always full
 * width and every other row is legible as a fraction of it. The percentage
 * printed on each row is of the total, which is the number that means
 * something — so the bar is the comparison and the number is the fact.
 */
export function BarList({
  rows,
  empty = "Nothing recorded yet.",
  className,
  tone = "brand",
}: {
  rows: { key: string; count: number; href?: string }[];
  empty?: string;
  className?: string;
  tone?: "brand" | "retail" | "value";
}) {
  if (rows.length === 0) {
    return <p className={cn("px-5 py-8 text-center text-body-sm text-ink-muted", className)}>{empty}</p>;
  }

  const max = Math.max(...rows.map((r) => r.count), 1);
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const fill = {
    brand: "var(--c-brand-soft)",
    retail: "var(--c-retail-soft)",
    value: "var(--c-value-soft)",
  }[tone];

  return (
    <ul className={cn("divide-y divide-line", className)}>
      {rows.map((r) => (
        <li key={r.key} className="relative px-5 py-2.5">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-r-sm"
            style={{ width: `${(r.count / max) * 100}%`, backgroundColor: fill }}
          />
          <span className="relative flex items-center justify-between gap-4">
            <span className="truncate text-body-sm text-ink">{r.key}</span>
            <span className="tabular shrink-0 text-body-sm text-ink-subtle">
              {r.count.toLocaleString("en-IN")}
              <span className="ml-2 text-label-xs text-ink-faint">
                {total > 0 ? `${Math.round((r.count / total) * 100)}%` : "—"}
              </span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------------- */

/** 0 / 25 / 50 / 75 / 100, not 0 / 23 / 46 / 69 / 92. */
function niceCeiling(max: number): number {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= max) return candidate;
  }
  return 10 * magnitude;
}

/** "27 Aug" — the year is never in doubt over a 90-day window. */
function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}
