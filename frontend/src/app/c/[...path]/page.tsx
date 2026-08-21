import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCategories, getCategory, getFacets, listProducts } from "@/lib/api";
import type { SortOption } from "@/lib/types";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductCard } from "@/components/product/ProductCard";
import { FilterRail } from "@/components/category/FilterRail";
import { SortSelect } from "@/components/category/SortSelect";

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
  const sort = (sp.sort as SortOption) ?? "score_desc";

  const [categories, results, facets] = await Promise.all([
    getCategories(),
    listProducts({
      category: category.slug,
      brand: brandFilter,
      minScore: sp.minScore ? Number(sp.minScore) : undefined,
      sort,
      pageSize: 48,
    }),
    getFacets(category.slug),
  ]);

  return (
    <>
      <SiteHeader categories={categories} />

      <main id="main">
        {/* --- Category header --- */}
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
            <p className="tabular mt-5 font-label text-label uppercase tracking-[0.08em] text-ink-subtle">
              {results.total} products researched
            </p>
          </div>
        </div>

        {/* --- Filter rail + grid. The rail is a fixed 260px column; the grid
                takes everything else, so widening the window widens the grid. */}
        <div className="shell-wide py-10">
          <div className="grid gap-10 lg:grid-cols-[260px_minmax(0,1fr)] xl:gap-14">
            <FilterRail facets={facets} basePath={`/c/${path.join("/")}`} />

            <div>
              {/* Stacks below `sm`: a native <select> refuses to shrink past its
                  longest option (~164px), so count + label + control cannot
                  share a line inside a 360px phone without overflowing. */}
              <div className="mb-6 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <p className="tabular shrink-0 whitespace-nowrap text-body-sm text-ink-subtle">
                  Showing {results.items.length} of {results.total}
                </p>
                <SortSelect value={sort} />
              </div>

              {results.items.length === 0 ? (
                <div className="dot-matrix rounded-lg border border-line py-24 text-center">
                  <p className="text-body-lg text-ink">Nothing matches those filters.</p>
                  <p className="mt-2 text-body-sm text-ink-muted">Try widening the price or score range.</p>
                </div>
              ) : (
                <div className="grid-products">
                  {results.items.map((p, i) => (
                    <ProductCard key={p.id} product={p} priority={i < 6} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}
