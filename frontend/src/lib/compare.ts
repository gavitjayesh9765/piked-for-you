import type { Product, ProductSummary } from "@/lib/types";

/**
 * The comparison shortlist — shared vocabulary between the picker control, the
 * shelf, and /compare itself.
 *
 * The number is three because the comparison page says three, in prose, on the
 * page ("Up to 3 at a time"). It is also the honest ceiling for the table it
 * renders: a fourth column puts a phone into horizontal scroll before the first
 * criterion is legible.
 */
export const MAX_COMPARE = 3;

/**
 * A shelf entry.
 *
 * Deliberately NOT a `ProductSummary`. This is persisted to session storage and
 * re-read on the next navigation, so everything in it is either identity or a
 * label — nothing that can go stale and be shown as if it were current. A price
 * held here for twenty minutes would be a price we are quietly asserting, and
 * this project checks prices under an admin's hand precisely so that does not
 * happen. The comparison page re-fetches each product in full anyway.
 */
export interface CompareItem {
  /** `category-slug/product-slug` — the key /compare's `?p=` already speaks. */
  key: string;
  title: string;
  brandName: string;
  categorySlug: string;
  categoryName: string;
}

/** The `?p=` key for a product, in the exact shape /compare parses. */
export function compareKey(product: ProductSummary | Product): string {
  return `${product.category.slug}/${product.slug}`;
}

export function toCompareItem(product: ProductSummary | Product): CompareItem {
  return {
    key: compareKey(product),
    title: product.title,
    brandName: product.brand.name,
    categorySlug: product.category.slug,
    categoryName: product.category.name,
  };
}

/** The shareable comparison URL. Order is selection order, which is the order
 *  the reader built and therefore the order the table should read in. */
export function compareHref(items: CompareItem[]): string {
  const params = new URLSearchParams();
  items.forEach((i) => params.append("p", i.key));
  return `/compare?${params.toString()}`;
}
