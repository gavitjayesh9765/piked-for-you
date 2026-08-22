import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { search } from "@/lib/api";
import { ProductGridArriving } from "@/components/ui/Arriving";
import { brandHref, categoryHref } from "@/lib/format";

import { SearchField } from "@/components/ui/SearchField";
import { ProductCard } from "@/components/product/ProductCard";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

/**
 * Search (spec §33). Results are grouped by entity type — products, categories,
 * brands — because "sony" and "headphones" are different kinds of intent and
 * flattening them into one list serves neither.
 *
 * Only published products are returned; that filter is enforced by the API.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const hasQuery = q.trim().length > 0;

  return (
    <main id="main">
      {/* Search takes the full width of the viewport — it is the front door */}
      <div className="border-b border-line bg-surface-1">
        <div className="shell-wide py-14">
          <h1 className="t-headline text-ink">
            {hasQuery ? <>Results for “{q}”</> : "What are you trying to buy?"}
          </h1>
          <div className="mt-8 max-w-3xl">
            <SearchField size="lg" defaultValue={q} autoFocus={!hasQuery} />
          </div>

          {!hasQuery && (
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="t-eyebrow mr-2">Try</span>
              {["noise cancelling headphones", "gaming mouse", "monitor under 30000", "sony"].map((s) => (
                <Link
                  key={s}
                  href={`/search?q=${encodeURIComponent(s)}`}
                  className="rounded-full border border-line px-4 py-2 text-body-sm text-ink-muted
                             transition-colors duration-fast hover:border-brand hover:text-brand"
                >
                  {s}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasQuery ? (
        <Suspense key={q} fallback={<SearchResultsArriving />}>
          <SearchResults q={q} />
        </Suspense>
      ) : null}
    </main>
  );
}

/**
 * The results themselves.
 *
 * The page above renders from the query string alone — the heading, the field
 * with the query already in it, the suggestion chips — so a search navigation
 * paints its destination before the search has run. Only this part waits on the
 * API, and it is keyed on the query so a new search replaces the old results
 * rather than appearing to amend them.
 */
async function SearchResults({ q }: { q: string }) {
  const results = await search(q);
  const isEmpty =
    results.total === 0 && !results.brands.length && !results.categories.length;

  return (
    <>
      {isEmpty && (
        <div className="shell-wide py-24">
          <div className="dot-matrix rounded-lg border border-line py-24 text-center">
            <p className="text-body-lg text-ink">We haven&apos;t researched anything matching “{q}” yet.</p>
            <p className="mt-2 text-body-sm text-ink-muted">
              We only list products we&apos;ve actually evaluated — so the catalogue is smaller than a
              marketplace, on purpose.
            </p>
          </div>
        </div>
      )}

      {results.categories.length > 0 && (
        <section className="shell-wide pt-12">
          <h2 className="t-eyebrow border-b border-line pb-4">Categories</h2>
          <div
            className="mt-6 grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(200px, 100%), 1fr))" }}
          >
            {results.categories.map((c) => (
              <Link
                key={c.id}
                href={categoryHref(c)}
                className="panel flex items-center gap-3 p-4 transition-colors duration-fast hover:border-brand-line"
              >
                <CategoryIcon name={c.icon} className="h-5 w-5 text-ink-subtle" />
                <span className="text-body-md text-ink">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.brands.length > 0 && (
        <section className="shell-wide pt-12">
          <h2 className="t-eyebrow border-b border-line pb-4">Brands</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            {results.brands.map((b) => (
              <Link
                key={b.id}
                href={brandHref(b.slug)}
                className="panel px-6 py-3 font-display text-headline-sm text-ink
                           transition-colors duration-fast hover:border-brand-line"
              >
                {b.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {results.products.length > 0 && (
        <section className="shell-wide pt-12">
          <div className="flex items-baseline justify-between border-b border-line pb-4">
            <h2 className="t-eyebrow">Products</h2>
            <span className="tabular text-body-sm text-ink-subtle">{results.total} found</span>
          </div>
          <div className="grid-products stagger mt-6">
            {results.products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 6} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

/** Height for the grid that is coming, and nothing else. */
function SearchResultsArriving() {
  return (
    <section className="shell-wide pt-12">
      <ProductGridArriving count={8} />
    </section>
  );
}
