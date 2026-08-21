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
 */
export function CategoryTiles({ categories }: { categories: Category[] }) {
  return (
    <div className="grid-tiles" style={{ "--tile-min": "150px" } as React.CSSProperties}>
      {categories
        .filter((c) => c.isActive && c.showOnHomepage)
        .map((c) => (
          <Link
            key={c.id}
            href={categoryHref(c)}
            className="panel group flex flex-col items-center justify-center gap-3 px-4 py-7
                       transition-all duration-fast ease-ease hover:border-brand-line hover:bg-brand-soft"
          >
            <CategoryIcon
              name={c.icon}
              className="h-7 w-7 text-ink-subtle transition-colors duration-fast group-hover:text-brand"
            />
            <span className="font-label text-label font-semibold uppercase tracking-[0.06em] text-ink transition-colors duration-fast group-hover:text-brand">
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
