import { cn } from "@/lib/cn";

/**
 * What occupies a `<Suspense>` fallback on this site.
 *
 * ---------------------------------------------------------------------------
 * THE RULE
 *
 * These are not skeletons and must never become skeletons. No shimmer, no
 * pulse, no grey blocks standing in for words. A shimmering placeholder is a
 * loading animation wearing a costume: it draws the eye to the wait, and it
 * animates for as long as the wait lasts, so the slower the request the more
 * insistently the interface flails.
 *
 * What these render instead is the **outline of the layout that is coming** —
 * the same grid, the same card geometry, the same row rhythm — drawn in the
 * faintest line colour the palette has, and completely still. When the real
 * content replaces it, nothing moves and nothing resizes; ink simply appears
 * where the frame already was.
 *
 * ---------------------------------------------------------------------------
 * THE PART THAT MATTERS MOST
 *
 * Every one of them carries `.deferred` (see globals.css), which holds the
 * element at zero opacity for its first 420ms. A navigation that resolves
 * inside that window — a prefetched link, a warm cache, anything on a normal
 * connection — mounts the fallback, paints nothing at all, and unmounts it. The
 * reader goes from the old page to the new one having seen no intermediate
 * state whatsoever.
 *
 * So in the common case this component is invisible by construction, and the
 * site keeps its promise of never showing a loading state. What it buys is the
 * uncommon case: the API here sleeps on a free tier and can take tens of
 * seconds to wake (see TIMEOUT_MS in lib/api.ts). Showing a still, honest
 * outline then is far better than a frozen page — and far better than pretending
 * the wait is not happening.
 */

/** The product grid, before the products. */
export function ProductGridArriving({ count = 8 }: { count?: number }) {
  return (
    <div className="grid-products deferred" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-lg border border-line-faint"
        >
          {/* Matches the card's image plate, so the grid's row heights are
              settled before a single image has loaded. */}
          <div className="aspect-[4/3] w-full border-b border-line-faint bg-surface-1/40" />
          <div className="flex flex-col gap-2 p-4">
            <Bar className="w-1/3" />
            <Bar className="w-11/12" />
            <Bar className="w-2/3" />
            <Bar className="mt-2 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A table, before its rows — the panel, the rule under the head, the row
 * rhythm. This is the admin panel's default fallback: every list screen there
 * resolves to a `.panel` wrapping a table, so they all reserve the same shape
 * and none of them jumps when the data lands.
 */
export function TableArriving({ rows = 8 }: { rows?: number }) {
  return (
    <div className="panel overflow-hidden" aria-hidden="true">
      <div className="border-b border-line px-5 py-3">
        <Bar className="w-1/5" />
      </div>
      <div className="px-5">
        <RowsArriving rows={rows} />
      </div>
    </div>
  );
}

/** A stack of rows — search results, review lists, admin tables. */
export function RowsArriving({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("deferred", className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line-faint py-4 last:border-b-0">
          <Bar className="w-1/4" />
          <Bar className="w-1/3" />
          <Bar className="ml-auto w-16" />
        </div>
      ))}
    </div>
  );
}

/** A bordered block whose contents are still resolving — a rail, a panel. */
export function PanelArriving({
  className,
  lines = 5,
}: {
  className?: string;
  lines?: number;
}) {
  return (
    <div className={cn("deferred", className)} aria-hidden="true">
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }, (_, i) => (
          <Bar key={i} className={i === 0 ? "w-1/2" : "w-full"} />
        ))}
      </div>
    </div>
  );
}

/**
 * A single value that has not arrived — a count, a price, a status.
 *
 * Sized in `ch` from the width the real value will take, so the line it sits on
 * does not reflow when the number lands.
 */
export function ValueArriving({ width = 6 }: { width?: number }) {
  return (
    <span
      aria-hidden="true"
      className="deferred inline-block h-[1em] translate-y-[0.1em] rounded-xs bg-line-faint align-baseline"
      style={{ width: `${width}ch` }}
    />
  );
}

function Bar({ className }: { className?: string }) {
  return <span className={cn("block h-2.5 rounded-xs bg-line-faint", className)} />;
}
