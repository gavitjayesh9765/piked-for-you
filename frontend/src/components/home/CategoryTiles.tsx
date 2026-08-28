import Link from "next/link";
import type { Category } from "@/lib/types";
import { categoryHref } from "@/lib/format";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

/**
 * Category entry tiles (spec §11.3, §13). Fully data-driven — the icon is a
 * token name stored on the category record, so adding "Drones" in the admin
 * panel needs no frontend change (spec §6).
 *
 * Uses the fluid grid so a wide display gets more tiles per row rather than
 * bigger tiles.
 *
 * ---------------------------------------------------------------------------
 * THREE PER ROW ON A PHONE
 *
 * This grid was two-up below `sm`, which was fine when the strip held eight
 * categories and became a problem the moment the catalogue grew a second
 * department: twelve tiles at two per row is six rows and the better part of
 * eight hundred pixels of scrolling, for a section whose entire job is to let
 * someone see the range at a glance. Three per row halves it.
 *
 * A tile is a glyph and a word, so it survives the narrower track — but only
 * if the tile stops being sized for a laptop. Everything here that carries a
 * `sm:` is the desktop value; the base value is the phone's. The label steps
 * down a size and loses most of its letter-spacing, because tracking that
 * reads as considered at 12px on a 240px tile reads as a broken word at 11px
 * on a 111px one.
 */
export function CategoryTiles({ categories }: { categories: Category[] }) {
  return (
    <div
      className="grid-tiles stagger reveal-group"
      style={{ "--tile-min": "150px", "--tile-cols": "3" } as React.CSSProperties}
    >
      {categories
        .filter((c) => c.isActive && c.showOnHomepage)
        .map((c) => (
          <Link
            key={c.id}
            href={categoryHref(c)}
            /* `tile-sweep` runs a diagonal of brand tint behind the label on
               hover; `panel-raise` lifts the tile two pixels under it. The tint
               replaces the old `hover:bg-brand-soft`, which flipped the whole
               tile to a filled state in one 160ms step — eight of them in a row
               made the grid flicker as the pointer crossed it. */
            className="panel panel-raise tile-sweep group flex flex-col items-center justify-center
                       gap-2 px-2 py-5 hover:border-brand-line sm:gap-3 sm:px-4 sm:py-7"
          >
            <CategoryIcon
              name={c.icon}
              /* The icon lifts fractionally out of the label as the tile does —
                 enough to read as depth inside the tile, not as a second
                 animation competing with it. */
              className="h-6 w-6 text-ink-subtle transition-[color,transform] duration-base ease-ease
                         group-hover:-translate-y-0.5 group-hover:text-brand sm:h-7 sm:w-7"
            />
            {/* `text-balance` rather than a plain wrap: "Kitchen Appliances"
                breaks to two lines on a phone either way, and balanced it
                breaks into two words instead of a long line over a short one. */}
            <span
              className="text-balance text-center font-label text-label-xs font-semibold uppercase
                         leading-tight tracking-[0.04em] text-ink transition-colors duration-fast
                         group-hover:text-brand sm:text-label sm:tracking-[0.06em]"
            >
              {c.name}
            </span>
            {c.productCount != null && (
              <span className="tabular text-label-xs text-ink-faint">{c.productCount} researched</span>
            )}
          </Link>
        ))}
    </div>
  );
}
