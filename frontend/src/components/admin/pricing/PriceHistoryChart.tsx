import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { PriceHistory, PricePoint } from "@/lib/types";

/**
 * Price over time, drawn as inline SVG.
 *
 * No charting library: this is one line per retailer over at most a few
 * hundred points, and a dependency that ships a layout engine to draw it would
 * cost more than the whole feature. Inline SVG also renders in a Server
 * Component, so the chart is in the first HTML response rather than appearing
 * after hydration.
 *
 * Colours come from `currentColor` and the design tokens, so the chart follows
 * the theme without a second palette to keep in sync.
 */

const WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 12, right: 12, bottom: 22, left: 52 };

/** One line per retailer, in the order the tokens are meant to be used. */
const SERIES_COLOURS = [
  "var(--c-brand-vivid)",
  "var(--c-value-vivid)",
  "var(--c-ink-subtle)",
  "var(--c-retail-vivid)",
];

export function PriceHistoryChart({
  history,
  currency = "INR",
  className,
}: {
  history: PriceHistory;
  currency?: string;
  className?: string;
}) {
  const { points, summary } = history;

  // One point is a fact, not a trend. Drawing a line through it would imply a
  // history we do not have, so it gets a sentence instead of a chart.
  if (points.length < 2) {
    return (
      <div className={cn("rounded-md border border-line bg-surface-1 px-5 py-8", className)}>
        <p className="text-center text-body-sm text-ink-muted">
          {points.length === 0
            ? "No price history yet."
            : "Only one price recorded so far — a chart needs a second point to mean anything."}
        </p>
        <p className="mt-1 text-center text-label-xs text-ink-faint">
          History is written when a price changes, so a run that finds no change adds
          nothing here.
        </p>
      </div>
    );
  }

  // Group into one series per retailer. A single line averaged across
  // retailers would be a number nobody can buy the product for.
  const series = new Map<string, PricePoint[]>();
  for (const point of points) {
    const key = point.retailer ?? "Unknown";
    const bucket = series.get(key);
    if (bucket) bucket.push(point);
    else series.set(key, [point]);
  }

  const times = points.map((p) => new Date(p.capturedAt).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const prices = points.map((p) => p.price);

  // Pad the value axis by 8% so the highest and lowest points are not drawn
  // flat against the frame, where they read as clipped rather than extreme.
  const rawMin = Math.min(...prices);
  const rawMax = Math.max(...prices);
  const spread = rawMax - rawMin || rawMax * 0.1 || 1;
  const minPrice = Math.max(0, rawMin - spread * 0.08);
  const maxPrice = rawMax + spread * 0.08;

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const x = (iso: string) => {
    const span = maxTime - minTime || 1;
    return PAD.left + ((new Date(iso).getTime() - minTime) / span) * plotWidth;
  };
  const y = (price: number) =>
    PAD.top + plotHeight - ((price - minPrice) / (maxPrice - minPrice || 1)) * plotHeight;

  const gridLines = [0, 0.5, 1].map((t) => ({
    value: minPrice + (maxPrice - minPrice) * (1 - t),
    y: PAD.top + plotHeight * t,
  }));

  return (
    <figure className={cn("rounded-md border border-line bg-surface-1 p-4", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={
          `Price history over ${summary.windowDays} days. ` +
          `Lowest ${summary.lowest}, highest ${summary.highest}, latest ${summary.latest}.`
        }
      >
        {gridLines.map((line) => (
          <g key={line.y}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={line.y}
              y2={line.y}
              stroke="var(--c-line)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={line.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--c-ink-faint)"
              className="tabular"
            >
              {Math.round(line.value).toLocaleString("en-IN")}
            </text>
          </g>
        ))}

        {[...series.entries()].map(([name, seriesPoints], index) => {
          const sorted = [...seriesPoints].sort(
            (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
          );
          const colour = SERIES_COLOURS[index % SERIES_COLOURS.length];
          const path = sorted
            .map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.capturedAt)} ${y(p.price)}`)
            .join(" ");

          return (
            <g key={name}>
              <path
                d={path}
                fill="none"
                stroke={colour}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {sorted.map((p) => (
                <circle
                  key={`${name}-${p.capturedAt}`}
                  cx={x(p.capturedAt)}
                  cy={y(p.price)}
                  r="2.5"
                  fill={colour}
                >
                  {/* A native tooltip rather than a hover overlay: it works on
                      the first render, needs no JavaScript, and this chart is
                      a reference, not an exploration tool. */}
                  <title>
                    {name} · {formatPrice(p.price, p.currency || currency)} ·{" "}
                    {new Date(p.capturedAt).toLocaleDateString()}
                  </title>
                </circle>
              ))}
            </g>
          );
        })}

        <text x={PAD.left} y={HEIGHT - 6} fontSize="10" fill="var(--c-ink-faint)">
          {new Date(minTime).toLocaleDateString()}
        </text>
        <text
          x={WIDTH - PAD.right}
          y={HEIGHT - 6}
          textAnchor="end"
          fontSize="10"
          fill="var(--c-ink-faint)"
        >
          {new Date(maxTime).toLocaleDateString()}
        </text>
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-4">
          {[...series.keys()].map((name, index) => (
            <span key={name} className="flex items-center gap-1.5 text-label-xs text-ink-muted">
              <span
                aria-hidden="true"
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: SERIES_COLOURS[index % SERIES_COLOURS.length] }}
              />
              {name}
            </span>
          ))}
        </div>

        <div className="tabular flex flex-wrap gap-x-5 gap-y-1 text-label-xs text-ink-faint">
          {summary.lowest !== null && (
            <span>
              Low <span className="text-value">{formatPrice(summary.lowest, currency)}</span>
            </span>
          )}
          {summary.highest !== null && (
            <span>
              High <span className="text-ink-muted">{formatPrice(summary.highest, currency)}</span>
            </span>
          )}
          <span>
            {summary.count} point{summary.count === 1 ? "" : "s"} · {summary.windowDays} days
          </span>
        </div>
      </figcaption>
    </figure>
  );
}
