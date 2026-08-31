"use client";

import { cn } from "@/lib/cn";
import { MAX_COMPARE, type CompareItem } from "@/lib/compare";
import { useCompare } from "./CompareProvider";

/**
 * Add to / remove from the comparison shortlist.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A CHECKBOX
 *
 * Every marketplace draws this control as a checkbox labelled "Compare",
 * because on a marketplace it is a bulk-selection affordance sitting in a row
 * of them. Here it is the entry point to the one page that says out loud what
 * we think of a product versus its rivals — our own judgement, which is the
 * purple role in this palette (docs/02-design-system.md §2). Drawing it in the
 * checkbox grammar would file our verdict under store furniture.
 *
 * So: same shape and geometry as SaveButton, which has already solved this
 * exact placement problem — the card wraps both in a full-bleed link overlay,
 * and both have to sit above it and stop the click from navigating.
 *
 * Orange is not available to this control and never will be. Orange means
 * leaving for a retailer; comparing is the opposite of leaving.
 */
export function CompareButton({
  item,
  variant = "icon",
  className,
}: {
  item: CompareItem;
  variant?: "icon" | "full";
  className?: string;
}) {
  const compare = useCompare();

  // Rendered outside the site shell (styleguide, admin preview). No shelf to
  // add to, so no control — see `useCompare`.
  if (!compare) return null;

  const selected = compare.ready && compare.has(item.key);
  // The shortlist is full and this is not one of the three. The control stays
  // visible and says why on hover rather than vanishing: a control that
  // disappears when you pick a third product reads as a bug.
  const blocked = compare.ready && !selected && compare.items.length >= MAX_COMPARE;

  const label = selected
    ? "Remove from comparison"
    : blocked
      ? `Comparing ${MAX_COMPARE} already — remove one first`
      : "Add to comparison";

  function click(e: React.MouseEvent) {
    // The card's `after:inset-0` link overlay would otherwise take this click
    // and navigate to the product.
    e.preventDefault();
    e.stopPropagation();
    if (blocked) return;
    compare!.toggle(item);
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={click}
        aria-pressed={selected}
        aria-disabled={blocked}
        title={label}
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-full border px-6",
          "font-label text-label-xs font-semibold uppercase tracking-[0.08em]",
          "transition-all duration-fast ease-ease",
          selected
            ? "border-brand-vivid bg-brand-soft text-brand-on-soft"
            : blocked
              ? "cursor-not-allowed border-line text-ink-faint"
              : "border-line-strong text-ink hover:border-brand hover:text-brand",
          className,
        )}
      >
        <CompareGlyph filled={selected} />
        {selected ? "Comparing" : "Compare"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={selected}
      aria-disabled={blocked}
      aria-label={label}
      title={label}
      className={cn(
        // Geometry is SaveButton's, to the pixel. These two sit next to each
        // other in the card's control cluster from `lg`, and a 2px difference
        // between two adjacent circles is more visible than either of them.
        "relative z-10 grid h-8 w-8 place-items-center rounded-full border lg:h-9 lg:w-9",
        "transition-all duration-fast ease-ease",
        selected
          ? "border-brand-vivid bg-brand-soft text-brand"
          : blocked
            ? "cursor-not-allowed border-line bg-surface-0/90 text-ink-faint"
            : "border-line bg-surface-0/90 text-ink-subtle hover:border-brand hover:text-brand",
        className,
      )}
    >
      <CompareGlyph filled={selected} />
    </button>
  );
}

/**
 * Two columns of unequal height — the comparison table's own shape, and
 * unmistakable next to SaveButton's bookmark at 15px. A generic "⇄" or a
 * balance-scale glyph both read as "swap"; this one reads as "side by side",
 * which is what the page it opens is called.
 */
function CompareGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="9" width="6.5" height="11" rx="1.4" />
      <rect x="13.5" y="4" width="6.5" height="16" rx="1.4" />
    </svg>
  );
}
