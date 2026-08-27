import { listProducts } from "@/lib/api";
import type { ProductSummary } from "@/lib/types";
import { productFullName, productHref } from "@/lib/format";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * /feed.xml — the verdict feed, as RSS 2.0.
 *
 * ---------------------------------------------------------------------------
 * WHY A SITE BUILT IN 2026 SHIPS AN RSS FEED
 *
 * Not for readers with feed clients, though they are welcome. Three other
 * things consume this, and all three matter more:
 *
 *   1. Google Discover and News-adjacent surfaces treat a feed as a publishing
 *      signal — a site that ANNOUNCES new work, dated, in a fixed place, is
 *      shaped like a publication rather than a catalogue. A sitemap says "these
 *      URLs exist"; a feed says "this one is new, and here is when".
 *
 *   2. Answer engines and their crawlers poll feeds to find what changed
 *      without re-crawling a catalogue. A weekly verdict that a model learns
 *      about a month late is a recommendation nobody will ever be given.
 *
 *   3. Aggregators, newsletters and every "follow this site" integration.
 *      Costs one route; the alternative is being un-followable.
 *
 * ---------------------------------------------------------------------------
 * WHY IT IS HAND-BUILT XML AND NOT A LIBRARY
 *
 * RSS 2.0 is nine elements. A dependency for this would be a dependency to
 * audit, update and eventually remove, in exchange for saving thirty lines.
 *
 * The one thing hand-built XML gets wrong is escaping, so that is handled
 * explicitly below rather than hoped for — see `xml()`. Product titles and
 * verdict summaries are editor-authored, and this codebase already treats admin
 * input as untrusted where it reaches a parser (see lib/json-ld.ts for the
 * same argument about script tags).
 */

/** Matches app/sitemap.ts — new verdicts should not wait for a deploy. */
export const revalidate = 3600;

/** How many verdicts the feed carries. */
const LIMIT = 40;

/**
 * Escape a string for XML text and attribute content.
 *
 * All five predefined entities, not just the three that usually bite. `&` must
 * be replaced FIRST or it re-escapes the ampersands introduced by the others
 * and every entity in the document arrives doubled.
 *
 * Note this deliberately does not use CDATA, which is the usual shortcut here.
 * CDATA is not escaping — it is a section that ends at the first `]]>` in the
 * content, so a verdict summary containing that sequence would terminate the
 * element early and produce exactly the injection this function prevents.
 */
function xml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Control characters are illegal in XML 1.0 at any escape level — an
    // entity reference to one is still a parse error, so they are dropped
    // rather than encoded. Tab, newline and carriage return are legal and kept.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function item(product: ProductSummary): string {
  const url = absoluteUrl(productHref(product));
  const name = productFullName(product.brand, product.title);

  return `    <item>
      <title>${xml(name)}</title>
      <link>${xml(url)}</link>
      <description>${xml(product.tagline)}</description>
      <category>${xml(product.category.name)}</category>
      <!-- The permalink is the identity. \`isPermaLink="true"\` is the default
           but is stated anyway: readers that assume false treat the URL as an
           opaque id, and a republished verdict then arrives as a new item. -->
      <guid isPermaLink="true">${xml(url)}</guid>
    </item>`;
}

export async function GET(): Promise<Response> {
  let products: ProductSummary[] = [];
  try {
    const batch = await listProducts({ page: 1, pageSize: LIMIT, sort: "score_desc" });
    products = batch.items.filter((p) => p.status === "published");
  } catch (error) {
    // Same contract as app/sitemap.ts: a dead upstream yields an empty-but-valid
    // feed, never a failed build. An RSS reader handles a channel with no items;
    // it does not handle a 500, and a feed that 500s once tends to get unsubscribed.
    console.warn("[feed.xml] products unavailable — empty feed served.", error);
  }

  /**
   * RFC 822, which RSS requires and which `toUTCString()` produces exactly —
   * "Wed, 27 Aug 2026 10:00:00 GMT". ISO 8601 is the intuitive choice here and
   * is wrong: strict readers reject it, lenient ones silently date every item
   * to the epoch, and the feed then presents itself as fifty-six years stale.
   */
  const now = new Date().toUTCString();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(SITE_NAME)}</title>
    <link>${xml(SITE_URL)}</link>
    <description>${xml(SITE_DESCRIPTION)}</description>
    <language>en-IN</language>
    <lastBuildDate>${now}</lastBuildDate>
    <!-- Required by the RSS Best Practices profile and by several validators:
         the feed's own canonical address, so a copy served from anywhere else
         still points home. -->
    <atom:link href="${xml(absoluteUrl("/feed.xml"))}" rel="self" type="application/rss+xml" />
${products.map(item).join("\n")}
  </channel>
</rss>
`;

  return new Response(body, {
    headers: {
      // `application/rss+xml` rather than `text/xml`: it is what every reader
      // sniffs for on autodiscovery, and it is what stops a browser trying to
      // render the feed as a document.
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
