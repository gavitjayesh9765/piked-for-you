import type { MetadataRoute } from "next";

import { getBrands, getCategories, listProducts } from "@/lib/api";
import type { Brand, Category, ProductSummary } from "@/lib/types";
import { brandHref, categoryHref, productHref } from "@/lib/format";
import { absoluteUrl } from "@/lib/site";

/**
 * sitemap.xml (spec §47).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS DYNAMIC
 *
 * The catalogue is admin-controlled — publishing a product is a CMS action,
 * not a deploy (spec §73). A hand-maintained URL list would be stale the
 * moment anyone used the admin panel, so every content URL here is read from
 * the same API the pages read from.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY FETCH IS INDIVIDUALLY GUARDED
 *
 * `lib/api.ts` throws on an unreachable upstream, and this route is prerendered
 * during `next build`. Unguarded, a sleeping Render instance at build time
 * would not produce a smaller sitemap — it would fail the build outright, and
 * take a deploy that had nothing to do with SEO down with it.
 *
 * So each section degrades on its own. A dead API yields a sitemap containing
 * the static pages, which is correct-but-thin rather than absent, and the next
 * revalidation repairs it. A partially dead API still emits everything that
 * did answer.
 *
 * The one thing this must never do is emit a URL that 404s: an invalid sitemap
 * entry is worse than a missing one, because it spends crawl budget teaching
 * Google that our sitemap lies.
 */

/** Rebuild hourly. New products should not wait for a deploy to be listed. */
export const revalidate = 3600;

/**
 * The public products endpoint caps `page_size` at 100
 * (backend/app/modules/products/router.py). Walking it is the only way to
 * enumerate the catalogue.
 */
const PAGE_SIZE = 100;

/**
 * Hard stop on the pagination walk — 100 pages, so 10,000 products.
 *
 * This is a guard against a paginator bug (a `hasMore` that never goes false
 * would otherwise loop until the build times out), NOT a product limit. It is
 * also the point at which the sitemap itself needs attention: a single sitemap
 * file is capped by the protocol at 50,000 URLs / 50MB uncompressed, and
 * Next's own guidance is to shard well before that.
 *
 * WHEN THE CATALOGUE APPROACHES ~5,000 PRODUCTS, SHARD THIS FILE.
 * Export `generateSitemaps()` returning `[{ id: 0 }, { id: 1 }, ...]` and take
 * an `{ id }` argument here, fetching only that slice. Next then serves
 * /sitemap/0.xml, /sitemap/1.xml, ... and app/robots.ts must list each.
 * Until then a single file is simpler and equally correct.
 */
const MAX_PAGES = 100;

/**
 * Static, hand-maintained routes.
 *
 * Deliberately excludes everything `app/robots.ts` disallows and everything
 * carrying `robots: { index: false }` in its own metadata — /login, /register,
 * /forgot-password, /search, /account/**, /newsletter/confirm, /styleguide,
 * /admin/**. Listing a noindex URL in a sitemap is a direct contradiction:
 * one file asks Google to crawl it, the page then asks Google to forget it.
 */
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "daily", priority: 1.0 },
  { path: "/top-picks", changeFrequency: "daily", priority: 0.9 },
  { path: "/c", changeFrequency: "weekly", priority: 0.8 },
  { path: "/b", changeFrequency: "weekly", priority: 0.7 },
  { path: "/compare", changeFrequency: "weekly", priority: 0.6 },
  // The trust documents. Low priority as destinations, but they are what an
  // evaluator reads to decide whether the verdicts above are worth believing,
  // so they belong in the index rather than being crawled only via the footer.
  { path: "/how-we-score", changeFrequency: "monthly", priority: 0.6 },
  { path: "/how-we-research", changeFrequency: "monthly", priority: 0.6 },
  { path: "/editorial-policy", changeFrequency: "monthly", priority: 0.5 },
  { path: "/affiliate-disclosure", changeFrequency: "monthly", priority: 0.5 },
  { path: "/about", changeFrequency: "monthly", priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.4 },
  { path: "/help", changeFrequency: "monthly", priority: 0.4 },
  { path: "/help/report", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/cookies", changeFrequency: "yearly", priority: 0.2 },
];

/**
 * Run a fetch, or give up quietly.
 *
 * See the header note: a section that cannot load must not fail the sitemap.
 * The warning goes to the build log so an empty section is diagnosable rather
 * than mysterious.
 */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.warn(`[sitemap] ${label} unavailable — omitted from sitemap.`, error);
    return fallback;
  }
}

/** Walk the paginated products endpoint to completion. */
async function allProducts(): Promise<ProductSummary[]> {
  const out: ProductSummary[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const batch = await listProducts({ page, pageSize: PAGE_SIZE });
    out.push(...batch.items);
    if (!batch.hasMore || batch.items.length === 0) return out;
  }

  console.warn(
    `[sitemap] Stopped at ${MAX_PAGES} pages (${out.length} products). The ` +
      `catalogue has outgrown a single sitemap file — see MAX_PAGES.`,
  );
  return out;
}

/**
 * Flatten the category tree.
 *
 * `getCategories` returns roots with nested `children`, and every node is its
 * own indexable page — a sitemap listing only the roots would leave the deep
 * category pages, which are the ones that actually target "best X" queries,
 * discoverable by crawl alone.
 */
function flattenCategories(categories: Category[]): Category[] {
  const out: Category[] = [];
  const walk = (nodes: Category[]) => {
    for (const node of nodes) {
      if (node.isActive) out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(categories);
  return out;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [categories, brands, products] = await Promise.all([
    safe<Category[]>("categories", getCategories, []),
    safe<Brand[]>("brands", () => getBrands(), []),
    safe<ProductSummary[]>("products", allProducts, []),
  ]);

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const categoryEntries: MetadataRoute.Sitemap = flattenCategories(categories).map((c) => ({
    url: absoluteUrl(categoryHref(c)),
    lastModified: now,
    changeFrequency: "daily",
    // Category pages rank for the highest-intent queries on the site
    // ("best headphones under 5000"), above any single product page.
    priority: 0.8,
  }));

  const brandEntries: MetadataRoute.Sitemap = brands.map((b) => ({
    url: absoluteUrl(brandHref(b.slug)),
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  /**
   * Published only. `listProducts` is the public endpoint and the API already
   * filters drafts and archives (spec §38, §61) — this is the same defence in
   * depth the product page applies, and it matters more here: a sitemap is a
   * standing invitation to crawl, so a leaked draft would be actively fetched
   * rather than merely reachable.
   *
   * No `lastModified`: ProductSummary carries no `updatedAt`, and a fabricated
   * timestamp is worse than none. Google treats an always-"today" lastmod as
   * noise and stops trusting the signal across the whole file.
   */
  const productEntries: MetadataRoute.Sitemap = products
    .filter((p) => p.status === "published")
    .map((p) => ({
      url: absoluteUrl(productHref(p)),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...staticEntries, ...categoryEntries, ...brandEntries, ...productEntries];
}
