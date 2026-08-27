import { jsonLd } from "@/lib/json-ld";
import { productFullName, productHref } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";
import type { ProductSummary } from "@/lib/types";

/**
 * `ItemList` structured data for a ranked list of products.
 *
 * ---------------------------------------------------------------------------
 * WHY THE LIST PAGES NEED THIS AND THE PRODUCT PAGE DOES NOT
 *
 * A product page answers "should I buy this one?", and its `Product` markup
 * says what "this one" is. A category page answers a different and commercially
 * far more valuable question — "what should I buy?" — and until now said
 * nothing structurally about the answer. To a crawler it was a heading, some
 * prose, and forty anchor tags.
 *
 * `ItemList` states the thing the page is actually for: that these products are
 * an ORDERED ranking, in this order, chosen by us. That ordering claim is what
 * makes a "best X" listing eligible to be treated as a curated list rather than
 * as an arbitrary index of links.
 *
 * ---------------------------------------------------------------------------
 * WHY THE ITEMS ARE URLS, NOT NESTED PRODUCTS
 *
 * Each entry is a bare `url` pointing at the product's own page, rather than an
 * inlined `Product` object with its price and rating repeated here.
 *
 * That is the documented preference for a summary page, and it is also the only
 * honest option available. `ProductSummary` carries no images array, no verdict
 * and no review — a nested `Product` built from it would be a thinner, and
 * within minutes a staler, copy of markup that already exists at full fidelity
 * one click away. Two disagreeing descriptions of one product is worse than
 * one, and the one that would be wrong is this one.
 *
 * So this asserts the ranking, and delegates every fact about each item to the
 * page that owns it.
 */
/** The `@id` this component gives the list on a page. Exported so
 *  <CollectionPageJsonLd> can point `mainEntity` at it without the two files
 *  agreeing on a string by coincidence. */
export function itemListId(path: string): string {
  return `${absoluteUrl(path)}#itemlist`;
}

export function ItemListJsonLd({
  products,
  name,
  /** Site-relative path of the page carrying this list. Gives the node an
   *  addressable `@id` — see `itemListId` above. */
  path,
  /**
   * Where the ranking starts. Always 1 for a first page; exists so a paginated
   * listing can continue the numbering rather than restarting it, which would
   * declare five different products to be rank 1.
   */
  startPosition = 1,
}: {
  products: ProductSummary[];
  name: string;
  path: string;
  startPosition?: number;
}) {
  // An empty ItemList is not a neutral thing to emit — it is a positive claim
  // that the ranking is empty, on a page that is usually mid-filter or
  // mid-fetch when that happens.
  if (products.length === 0) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "@id": itemListId(path),
          name,
          numberOfItems: products.length,
          // The grid is sorted — by our score at default, by price or rating on
          // request — so the order on screen is meaningful in every case.
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          itemListElement: products.map((product, index) => ({
            "@type": "ListItem",
            position: startPosition + index,
            url: absoluteUrl(productHref(product)),
            name: productFullName(product.brand, product.title),
          })),
        }),
      }}
    />
  );
}
