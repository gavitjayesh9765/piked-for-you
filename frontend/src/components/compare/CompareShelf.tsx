"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MAX_COMPARE, compareHref } from "@/lib/compare";
import { useCompare } from "./CompareProvider";

/**
 * The comparison shelf.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS TYPE, NOT THUMBNAILS
 *
 * The reflex build is a row of product photographs in boxes with a coloured
 * button on the right — which is the compare tray every marketplace ships, and
 * it reads as a cart the moment it appears. This site has already answered the
 * question "what does choosing things to compare look like here": it is the
 * `Picker` on /compare, and it is brand eyebrow, product title, hairline rule.
 * No images. The shelf is the same list turned on its side, so arriving at
 * /compare continues the thing already on screen rather than opening a new one.
 *
 * It also happens to be the honest medium. A 40px thumbnail of three pairs of
 * black over-ear headphones tells the reader nothing; the names tell them
 * everything.
 *
 * ---------------------------------------------------------------------------
 * WHY ONE PICK IS A STATEMENT AND NOT A DISABLED BUTTON
 *
 * With a single pick there is nothing to compare yet. A greyed-out
 * "Compare (1)" makes the reader work out why it is dead. The shelf says "One
 * more to compare" instead — same information, no puzzle, and it is the only
 * instruction the control ever needs.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS NOT ON /compare
 *
 * That page has its own picker and its own remove controls. A shelf across the
 * bottom of it would be a second, disagreeing copy of the same state.
 */
export function CompareShelf() {
  const compare = useCompare();
  const pathname = usePathname();

  /**
   * The bar's real height, measured.
   *
   * A fixed element cannot push a page, so the spacer below the footer is what
   * stops the shelf covering the last line of it. That spacer was a hardcoded
   * 5.25rem, which is the height of the ONE-row desktop layout — and the shelf
   * is two rows on a phone, where the chips and the action stack. It was
   * covering about 130px of footer on exactly the viewport that can least
   * afford to lose it.
   *
   * Measuring rather than writing a second constant: the height also moves with
   * the type scale, the safe-area inset, and the conflict state's wrapping
   * paragraph. Any constant here is a constant that will be wrong for one of
   * them.
   */
  const barRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const measure = () => setHeight(el.offsetHeight);
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // Re-observes when the bar appears: it is not in the DOM until the
    // shortlist has been read back from storage.
  }, [compare?.ready]);

  if (!compare || !compare.ready) return null;
  if (pathname === "/compare") return null;

  const { items, conflict } = compare;
  const open = items.length > 0 || conflict != null;

  return (
    <>
      {/* Sits after the footer in normal flow and grows to match the bar. */}
      <div
        aria-hidden="true"
        className="transition-[height] duration-base ease-ease"
        style={{ height: open ? height : 0 }}
      />

      <div
        ref={barRef}
        // `pointer-events-none` while closed: the bar stays in the DOM,
        // translated off-screen, and without this it holds a strip of the
        // viewport bottom — right over the footer links — permanently dead.
        className={[
          "glass-top fixed inset-x-0 bottom-0 z-sticky",
          "transition-transform duration-base ease-ease",
          open ? "translate-y-0" : "pointer-events-none translate-y-full",
        ].join(" ")}
        role="region"
        aria-label="Comparison shortlist"
        /* The ascent dial parks in the bottom-left corner and would sit on top
           of the category label. BackToTop already watches for this attribute
           and lifts above anything carrying it — see the DOCKING note in
           components/layout/BackToTop.tsx. Nothing to do when the shelf is
           closed: it is translated below the viewport, so its top edge is
           under the dial's floor and no lift is computed. */
        data-dock-obstacle
      >
        <div className="shell py-3">{conflict ? <Conflict /> : <Shortlist />}</div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Shortlist() {
  const { items, remove, clear } = useCompare()!;

  // Read defensively, because this component keeps rendering through the close
  // transition: clearing sets `items` to [] and the bar takes 240ms to leave.
  const categoryName = items[0]?.categoryName ?? "";
  const ready = items.length >= 2;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <p className="t-eyebrow hidden shrink-0 whitespace-nowrap lg:block">
          Comparing{categoryName ? ` · ${categoryName}` : ""}
        </p>

        {/* Scrolls rather than wraps. Wrapping doubles the shelf's height on a
            phone at three picks, and that height is what the spacer above and
            the translate-out distance are both budgeted against. */}
        <ul className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {items.map((item) => (
            <li key={item.key} className="shrink-0">
              <div className="flex items-center gap-2.5 rounded-sm border border-line bg-surface-0 py-1.5 pl-3 pr-1.5">
                <span className="flex items-baseline gap-2">
                  {/* The brand is the first thing the /compare picker shows and
                      the first thing the card shows. It is dropped below `sm`
                      only because two names plus a close target will not fit a
                      360px viewport three times over. */}
                  <span className="t-eyebrow hidden sm:inline">{item.brandName}</span>
                  <span className="max-w-[10rem] truncate text-body-sm text-ink">{item.title}</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(item.key)}
                  aria-label={`Remove ${item.brandName} ${item.title} from the comparison`}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-xs text-ink-faint
                             transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
                >
                  <CrossGlyph />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
        {ready ? (
          <button
            type="button"
            onClick={clear}
            className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint
                       transition-colors duration-fast hover:text-ink"
          >
            Clear
          </button>
        ) : (
          <p className="text-body-sm text-ink-subtle">
            {/* The ceiling is stated where the reader is already counting,
                rather than only on the error path when they pick a fourth. */}
            One more to compare<span className="text-ink-faint"> · up to {MAX_COMPARE}</span>
          </p>
        )}

        {ready ? (
          <Link
            href={compareHref(items)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-fill px-6
                       font-label text-label-xs font-semibold uppercase tracking-[0.08em]
                       text-brand-on-fill transition-opacity duration-fast ease-ease hover:opacity-90"
          >
            Compare {items.length}
            <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The cross-category state.
 *
 * /compare already refuses to draw a mixed table, and explains why. The problem
 * was only ever WHEN it said so: after the reader had built the comparison and
 * clicked through. Saying it here costs the same sentence and leaves both doors
 * open, because at this moment either is reasonable — they may have finished
 * with the first category, or they may have mis-tapped.
 */
function Conflict() {
  const { conflict, resolveConflict } = useCompare()!;
  if (!conflict) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <p className="max-w-2xl text-body-sm text-ink-muted">
        <span className="text-ink">{conflict.incoming.title}</span> is in{" "}
        {conflict.incoming.categoryName}, and you are comparing {conflict.heldCategoryName}. Every
        score is built from its own category&rsquo;s rubric, so the two do not share a scale.
      </p>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => resolveConflict("dismiss")}
          className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint
                     transition-colors duration-fast hover:text-ink"
        >
          Keep {conflict.heldCategoryName}
        </button>
        <button
          type="button"
          onClick={() => resolveConflict("replace")}
          className="inline-flex h-11 shrink-0 items-center rounded-full border border-line-strong px-5
                     font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink
                     transition-colors duration-fast hover:border-brand hover:text-brand"
        >
          Start with this instead
        </button>
      </div>
    </div>
  );
}

function CrossGlyph() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
