import { jsonLd } from "@/lib/json-ld";
import { absoluteUrl } from "@/lib/site";

/**
 * `CollectionPage` structured data for a listing page.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS ADDS THAT `ItemList` DOES NOT
 *
 * The two are complementary and it is worth being precise about the split,
 * because "we already have ItemList" is the obvious reason not to add this.
 *
 *   `ItemList` (components/seo/ItemListJsonLd.tsx) describes the RANKING: these
 *     products, in this order, chosen by us. It says nothing about the page.
 *
 *   `CollectionPage` describes the PAGE: what it is about, who published it,
 *     which site it belongs to, and — the part that does the work — that it is
 *     a curated collection rather than an arbitrary index of links.
 *
 * Without the second one, a category page presents a crawler with an ordered
 * list floating in an untyped document. The list asserts a ranking that nothing
 * claims authorship of, which is exactly the shape of the affiliate listicles
 * we are competing against. Naming the publisher — as the same `@id` the
 * homepage `Organization` uses, so the graph joins up instead of describing a
 * second company with our name — attaches the ranking to a publication that
 * has stated editorial principles and an ethics policy.
 *
 * For an answer engine deciding which of ten "best wireless earbuds" pages to
 * cite, that provenance chain is the whole question.
 *
 * ---------------------------------------------------------------------------
 * WHY `mainEntity` POINTS AT THE ItemList RATHER THAN INLINING IT
 *
 * Both blocks are emitted on the same page, so inlining would put every product
 * URL in the document twice. Instead the ItemList carries an `@id` and this
 * references it: one list, two nodes describing it from different angles, which
 * is what `@id` is for. Two full copies of a forty-item ranking would invite a
 * crawler to reconcile them, and the reconciliation has no upside even when it
 * succeeds.
 */
export function CollectionPageJsonLd({
  path,
  name,
  description,
  /**
   * `@id` of the `ItemList` on the same page, when there is one. Omitted on
   * listing pages that have no ranking of their own — the brands index, for
   * instance, which is a directory rather than a curated order.
   */
  itemListId,
  /**
   * The entity this page is ABOUT, when it is about something with its own
   * node — a `Brand`, typically. A category has no such entity: it is a
   * taxonomy bucket, not a thing in the world, so this is left off there
   * rather than inventing a node for it.
   */
  about,
}: {
  path: string;
  name: string;
  description: string;
  itemListId?: string;
  about?: Record<string, unknown>;
}) {
  const url = absoluteUrl(path);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd({
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          "@id": `${url}#collection`,
          url,
          name,
          description,
          inLanguage: "en-IN",
          isPartOf: { "@id": absoluteUrl("/#website") },
          publisher: { "@id": absoluteUrl("/#organization") },
          // The publication is the author of its own rankings. Same node, not a
          // fresh Organization that happens to share the name — see the note on
          // the product page's Review author for why that distinction matters.
          author: { "@id": absoluteUrl("/#organization") },
          ...(itemListId ? { mainEntity: { "@id": itemListId } } : {}),
          ...(about ? { about } : {}),
        }),
      }}
    />
  );
}
