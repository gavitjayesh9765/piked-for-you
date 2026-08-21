/**
 * Sort and filter vocabulary for the admin catalogue.
 *
 * Its own module, not part of `admin-api.ts`, because the filter bar is a
 * Client Component and `admin-api.ts` reaches `next/headers` through
 * `getAdminSession`. Importing it from the browser bundle is a build error —
 * and rightly so: nothing that resolves a session belongs in client code.
 * These are plain constants, safe on both sides.
 */

/**
 * Ordering the admin catalogue offers.
 *
 * A closed set rather than a free-text parameter. The value reaches a SQL
 * ORDER BY upstream — through a lookup table, not interpolation — and an
 * unrecognised value should be a 422 there rather than a silent fallback that
 * leaves an editor wondering why their sort did nothing.
 */
export const PRODUCT_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "updated_desc", label: "Recently edited" },
  { value: "published_desc", label: "Recently published" },
  { value: "price_checked_asc", label: "Price checked longest ago" },
  { value: "price_checked_desc", label: "Price checked most recently" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "score_desc", label: "PickD Score" },
  { value: "title_asc", label: "Title A–Z" },
  { value: "title_desc", label: "Title Z–A" },
] as const;

export type ProductSort = (typeof PRODUCT_SORTS)[number]["value"];

export function isProductSort(value: string | undefined): value is ProductSort {
  return PRODUCT_SORTS.some((s) => s.value === value);
}

/** How a listing may be narrowed by the state of its prices. */
export const PRICE_STATES = [
  { value: "", label: "Any price state" },
  { value: "missing", label: "No price yet" },
  { value: "present", label: "Has a price" },
  { value: "failing", label: "Last check failed" },
] as const;
