import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCategoriesForChrome, getCategory, getFacets, listProducts } from "@/lib/api";
import type { SortOption } from "@/lib/types";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductCard } from "@/components/product/ProductCard";
import { FilterRail } from "@/components/category/FilterRail";
import { SortSelect } from "@/components/category/SortSelect";
import { PanelArriving, ProductGridArriving, ValueArriving } from "@/components/ui/Arriving";
import { ItemListJsonLd, itemListId } from "@/components/seo/ItemListJsonLd";
import { CollectionPageJsonLd } from "@/components/seo/CollectionPageJsonLd";
import { categoryDescription, categoryTitle } from "@/lib/seo";

type Params = { path: string[] };
type Search = { sort?: string; brand?: string | string[]; minScore?: string };

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const [{ path }, sp] = await Promise.all([params, searchParams]);
  /**
   * Both in one round trip. `getCategoriesForChrome` is the whole taxonomy and
   * is already fetched by the site layout on every request, so Next's per-render
   * fetch memoization makes this free — and it is what tells `categoryTitle`
   * whether this category is a hub or a leaf. Without it the hub check falls
   * back to path depth and titles a two-level shelf "Best Audio". It is the
   * guarded variant deliberately: a title that has to degrade is much better
   * than a metadata function that throws.
   */
  const [category, all] = await Promise.all([getCategory(path), getCategoriesForChrome()]);
  // Same reasoning as the product page: a category that does not exist must not
  // leave an indexable page behind at the URL someone guessed.
  if (!category) return { title: "Category not found", robots: { index: false, follow: false } };

  /**
   * Whether any facet is applied.
   *
   * Every filter combination renders real, useful content, so none of this is
   * about hiding a thin page — the canonical below already points all of them
   * at the bare category path, which is the correct consolidation signal and
   * was in place before this change.
   *
   * What the canonical does not do is stop the crawl. The URL space here is the
   * product of every brand, every score threshold and every sort order, so a
   * category with 30 brands is thousands of distinct URLs that all resolve, all
   * render, and all collapse onto one. Google spends the budget discovering
   * that, once per combination, and it spends it instead of fetching the
   * product pages we actually want indexed.
   *
   * `noindex, follow` is the pairing that matters: don't keep these, but do
   * walk the product links on them, so nothing becomes less discoverable as a
   * result. app/robots.ts declines the crawl earlier for crawlers that read it;
   * this handles the ones that arrive anyway, from a shared filtered link.
   */
  const isFiltered = Boolean(sp.brand || sp.minScore || sp.sort);

  /**
   * Both strings come from lib/seo.ts rather than being built here.
   *
   * The title in particular changed shape: it was "{Category} — researched and
   * ranked", which never contained the word "best" and was therefore competing
   * for "best wireless earbuds" against pages whose titles match the phrase
   * exactly. The full argument — including why hub categories are titled
   * differently, and why this is not an overclaim — is in `categoryTitle`.
   */
  const title = categoryTitle(category, all);
  const description = categoryDescription(category, all);
  const canonical = `/c/${path.join("/")}`;

  return {
    title,
    description,
    alternates: { canonical },
    ...(isFiltered ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
    },
    twitter: {
      // Without this a shared category link unfurls as a `summary` card — a
      // favicon-sized thumbnail — because Twitter only inherits CONTENT from
      // Open Graph, never the card size. The root layout sets this for the
      // homepage; a route declaring its own `openGraph` does not inherit it.
      card: "summary_large_image",
      title,
      description,
    },
  };
}

/**
 * Category page (spec §17).
 *
 * This is the screen that most justifies the full-bleed decision: a filter rail
 * plus an auto-fill product grid. At 1440px the grid runs 4 across; at 2560px it
 * runs 7, with no extra breakpoints — the column count follows the available
 * width (docs/01-design-brainstorm.md §3.2).
 *
 * ---------------------------------------------------------------------------
 * HOW THIS PAGE ARRIVES
 *
 * It used to await three requests — the products, the facets, the taxonomy —
 * before rendering anything, which meant the reader stared at the *previous*
 * category until the slowest of the three came back. The page knew the new
 * category's name the whole time and said nothing.
 *
 * Now the page body awaits exactly one thing: the category itself, which is a
 * small cached lookup. Everything it can write from that — the breadcrumb
 * trail, the heading, the description, the researched count — is rendered
 * immediately, so the masthead of the destination is on screen in the same
 * frame the click lands. The two genuinely slow parts each sit behind their own
 * `<Suspense>` boundary and stream into place independently: a slow facet
 * query no longer holds up the products, and vice versa.
 *
 * Both fallbacks are invisible for their first 420ms (see <Arriving>), so a
 * prefetched navigation — which the sub-nav makes the common case — shows no
 * loading state of any kind. It simply becomes the new page.
 */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const [{ path }, sp] = await Promise.all([params, searchParams]);

  const [category, all] = await Promise.all([getCategory(path), getCategoriesForChrome()]);
  if (!category) notFound();

  const brandFilter = sp.brand ? (Array.isArray(sp.brand) ? sp.brand : [sp.brand]) : undefined;
  const minScore = sp.minScore ? Number(sp.minScore) : undefined;
  const sort = (sp.sort as SortOption) ?? "score_desc";

  const basePath = `/c/${path.join("/")}`;
  const query = { category: category.slug, brand: brandFilter, minScore, sort };

  return (
    <main id="main">
      {/* --- Category header ---

          Every value here comes from the category record, which is why the
          whole block can render before the product query has been issued. The
          researched count is the CATEGORY's total rather than the filtered
          result count it used to show: a masthead states a fact about the
          category, and how many rows a filter left is answered directly above
          the grid, where the filters are. That also makes it a known value
          rather than one more thing to wait for. */}
      <div className="border-b border-line bg-surface-1">
        <div className="shell-wide py-10">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              ...path.map((seg, i) => ({
                label: i === path.length - 1 ? category.name : seg.replace(/-/g, " "),
                href: `/c/${path.slice(0, i + 1).join("/")}`,
              })),
            ]}
          />
          <h1 className="mt-5 font-display text-display-lg text-ink">{category.name}</h1>
          {category.description && (
            <p className="mt-4 max-w-2xl text-body-lg text-ink-muted">{category.description}</p>
          )}
          {category.productCount != null && (
            <p className="tabular mt-5 font-label text-label uppercase tracking-[0.08em] text-ink-subtle">
              {category.productCount} products researched
            </p>
          )}
        </div>
      </div>

      {/* --- Filter rail + grid. The rail is a fixed 260px column; the grid
              takes everything else, so widening the window widens the grid. */}
      <div className="shell-wide py-10">
        <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-14">
          <Suspense fallback={<PanelArriving lines={7} className="hidden lg:block" />}>
            <Rail slug={category.slug} basePath={basePath} />
          </Suspense>

          <div>
            {/* Stacks below `sm`: a native <select> refuses to shrink past its
                longest option (~164px), so count + label + control cannot
                share a line inside a 360px phone without overflowing. */}
            <div className="mb-6 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <p className="tabular shrink-0 whitespace-nowrap text-body-sm text-ink-subtle">
                <Suspense fallback={<ValueArriving width={18} />}>
                  <ResultCount query={query} />
                </Suspense>
              </p>
              <SortSelect value={sort} />
            </div>

            {/* Keyed on the CATEGORY, deliberately not on the whole query.

                The two cases want opposite behaviour. Arriving from another
                category, the old category's products must go — leaving them
                under the new heading would be actively misleading — so the key
                changes, the boundary remounts, and the frame holds the height
                until the real grid lands.

                Changing a filter or the sort is not arriving anywhere; it is
                refining what is already on screen. The key is unchanged, React
                keeps the resolved boundary mounted, and the current results
                stay visible until the new ones replace them. Blanking a grid
                the reader is actively working with, to show them an outline of
                the grid they were already looking at, would be the single most
                obviously "loading" thing this page could do. */}
            <Suspense key={category.slug} fallback={<ProductGridArriving />}>
              <Results query={query} listName={categoryTitle(category, all)} basePath={basePath} />
            </Suspense>
          </div>
        </div>
      </div>

      {/* Describes the PAGE, where <ItemListJsonLd> inside <Results> describes
          the ranking on it. Emitted out here rather than beside the list
          because everything it says is known from the category record alone —
          holding it behind the product fetch would delay the one block that
          never needed to wait. `mainEntity` references the list by `@id`, so
          the two join up without either restating the other. */}
      <CollectionPageJsonLd
        path={basePath}
        name={categoryTitle(category, all)}
        description={categoryDescription(category, all)}
        itemListId={itemListId(basePath)}
      />
    </main>
  );
}

type Query = {
  category: string;
  brand: string[] | undefined;
  minScore: number | undefined;
  sort: SortOption;
};

/**
 * The two components below both call `listProducts` with identical arguments,
 * which costs one request, not two: Next memoizes `fetch` per render pass, and
 * `lib/api` builds the same URL for the same query.
 */
async function ResultCount({ query }: { query: Query }) {
  const results = await listProducts({ ...query, pageSize: 48 });
  return (
    <>
      Showing {results.items.length} of {results.total}
    </>
  );
}

async function Results({
  query,
  listName,
  basePath,
}: {
  query: Query;
  /** The page's own title, so the ranking is named the same way the <title>
   *  names it. Hardcoding `Best ${name}` here produced "Best Electronics —
   *  researched and ranked" on a page titled "Electronics buying guides". */
  listName: string;
  basePath: string;
}) {
  const results = await listProducts({ ...query, pageSize: 48 });

  if (results.items.length === 0) {
    return (
      <div className="enter dot-matrix rounded-lg border border-line py-24 text-center">
        <p className="text-body-lg text-ink">Nothing matches those filters.</p>
        <p className="mt-2 text-body-sm text-ink-muted">Try widening the price or score range.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid-products stagger">
        {results.items.map((p, i) => (
          <ProductCard key={p.id} product={p} priority={i < 6} />
        ))}
      </div>

      {/* Emitted here rather than in the page body because the ranking is what
          it describes, and the ranking does not exist until this fetch lands.
          Inside the same Suspense boundary as the grid, so the markup and the
          products it enumerates are always the same list — a copy built from a
          second call could disagree with what rendered. */}
      <ItemListJsonLd
        products={results.items}
        path={basePath}
        name={`${listName} — researched and ranked`}
      />
    </>
  );
}

async function Rail({ slug, basePath }: { slug: string; basePath: string }) {
  const facets = await getFacets(slug);
  return <FilterRail facets={facets} basePath={basePath} />;
}
