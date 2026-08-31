import Link from "next/link";

import { cn } from "@/lib/cn";

/**
 * Category pagination.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS AT ALL
 *
 * The category page fetched `pageSize: 48` and rendered "Showing 48 of 214"
 * under a grid with no way forward. Everything past the forty-eighth product in
 * a category was unreachable from the site — visible only in the sitemap, which
 * is not a place readers go.
 *
 * ---------------------------------------------------------------------------
 * WHY NOT A NUMBERED BAR
 *
 * "1 2 3 4 … 9 ›" is a lot of controls to answer one question, and the question
 * is almost never "take me to page 6" — it is "is there more, and how much".
 * Previous / position / Next answers that in three elements, in the same
 * tracked-label grammar the sort control and the result count already use on
 * this page.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ENDS ARE TEXT, NOT DISABLED BUTTONS
 *
 * On the first page "Previous" is not a control the reader may not use yet —
 * it is a direction that does not exist. A greyed-out button says "you cannot
 * do this", which invites the question "why not". Plain muted type says
 * "nothing that way", which does not.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE URLS ARE NOT MEANT TO BE CRAWLED
 *
 * `?page=2` joins `?brand=` and `?sort=` in the query space app/robots.ts
 * already declines with `/c/*?*`, and the page's own metadata marks it
 * `noindex, follow` alongside the facets. That is not a concession — product
 * discovery on this site is the sitemap's job, and app/sitemap.ts walks the
 * products endpoint to completion (up to 10,000). Letting a crawler page
 * through every category as well would spend budget rediscovering URLs it has
 * already been handed, in a space multiplied by every brand and every sort.
 */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  search,
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  /** The page's current query, so a filtered view stays filtered across a
   *  page change. Anything not named here is carried through untouched. */
  search: Record<string, string | string[] | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function href(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (key === "page" || value == null) continue;
      if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
      else params.set(key, value);
    }
    // Page one is the bare URL, not `?page=1`. Two URLs for one view is one
    // more than the canonical can consolidate, and it is the shape people
    // paste into messages.
    if (target > 1) params.set("page", String(target));

    const query = params.toString();
    // The grid, not the masthead. `scroll-padding-top` in globals.css already
    // offsets the sticky header stack, so this lands on the first row of cards
    // rather than under the sub-nav.
    return `${basePath}${query ? `?${query}` : ""}#results`;
  }

  const link =
    "font-label text-label-xs font-semibold uppercase tracking-[0.1em] transition-colors duration-fast";

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex items-center justify-between gap-4 border-t border-line pt-6"
    >
      {page > 1 ? (
        <Link href={href(page - 1)} className={cn(link, "text-ink hover:text-brand")}>
          <span aria-hidden="true">←</span> Previous
        </Link>
      ) : (
        <span className={cn(link, "text-ink-faint")}>
          <span aria-hidden="true">←</span> Previous
        </span>
      )}

      <p className="tabular font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle">
        Page {page} of {totalPages}
      </p>

      {page < totalPages ? (
        <Link href={href(page + 1)} className={cn(link, "text-ink hover:text-brand")}>
          Next <span aria-hidden="true">→</span>
        </Link>
      ) : (
        <span className={cn(link, "text-ink-faint")}>
          Next <span aria-hidden="true">→</span>
        </span>
      )}
    </nav>
  );
}
