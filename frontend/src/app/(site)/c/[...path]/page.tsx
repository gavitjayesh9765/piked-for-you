import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getCategory, getFacets, listProducts } from "@/lib/api";
import type { SortOption } from "@/lib/types";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductCard } from "@/components/product/ProductCard";
import { FilterRail } from "@/components/category/FilterRail";
import { SortSelect } from "@/components/category/SortSelect";
import { PanelArriving, ProductGridArriving, ValueArriving } from "@/components/ui/Arriving";

type Params = { path: string[] };
type Search = { sort?: string; brand?: string | string[]; minScore?: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { path } = await params;
  const category = await getCategory(path);
  if (!category) return { title: "Category not found" };
  return {
    title: `${category.name} — researched and ranked`,
    description: category.description ?? `Our researched picks in ${category.name}.`,
    alternates: { canonical: `/c/${path.join("/")}` },
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

  const category = await getCategory(path);
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
              <Results query={query} />
            </Suspense>
          </div>
        </div>
      </div>
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

async function Results({ query }: { query: Query }) {
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
    <div className="grid-products stagger">
      {results.items.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < 6} />
      ))}
    </div>
  );
}

async function Rail({ slug, basePath }: { slug: string; basePath: string }) {
  const facets = await getFacets(slug);
  return <FilterRail facets={facets} basePath={basePath} />;
}
