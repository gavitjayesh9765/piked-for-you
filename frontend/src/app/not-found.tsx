import Link from "next/link";

import { getCategoriesForChrome } from "@/lib/api";
import { categoryHref } from "@/lib/format";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SearchField } from "@/components/ui/SearchField";

/**
 * Global 404.
 *
 * Without this file Next renders its own unstyled page — a different typeface,
 * a white background, and no way back — which is a jarring exit from an
 * otherwise composed site.
 *
 * A 404 is a dead end, so the only useful thing it can do is offer the next
 * move. Search first, because someone who mistyped a product URL is looking
 * for a product, then the real category list rather than a generic "go home".
 */
export default async function NotFound() {
  // The taxonomy is live, so the suggestions stay correct as categories change
  // instead of rotting into links that 404 from the 404 page.
  const categories = await getCategoriesForChrome();
  const suggestions = categories
    .filter((c) => c.isActive && (c.productCount ?? 0) > 0)
    .sort((a, b) => (b.productCount ?? 0) - (a.productCount ?? 0))
    .slice(0, 6);

  return (
    <>
      <SiteHeader categories={categories} />

      <main id="main">
        <section className="relative overflow-hidden bg-bg">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

          <div className="shell-content relative py-24 lg:py-32">
            <p className="tabular font-mono text-label-xs font-medium tracking-[0.14em] text-brand">
              ERROR 404
            </p>

            <h1 className="t-display mt-5 text-ink">This page does not exist.</h1>

            <p className="mt-6 max-w-lg text-body-lg text-ink-muted">
              It may have moved, or the link may be wrong. Either way, here is the way back in.
            </p>

            <div className="mt-10 max-w-xl">
              <SearchField size="lg" />
            </div>

            {suggestions.length > 0 ? (
              <div className="mt-14">
                <p className="t-eyebrow border-b border-line pb-4">Categories with research</p>
                <ul className="mt-1">
                  {suggestions.map((c) => (
                    <li key={c.id} className="border-b border-line-faint last:border-b-0">
                      <Link
                        href={categoryHref(c)}
                        className="group flex items-baseline justify-between gap-4 py-3
                                   text-body-md text-ink transition-colors duration-fast hover:text-brand"
                      >
                        <span className="flex items-baseline gap-2">
                          {c.name}
                          <span
                            className="text-brand opacity-0 transition-all duration-fast ease-ease
                                       group-hover:translate-x-1 group-hover:opacity-100"
                            aria-hidden="true"
                          >
                            →
                          </span>
                        </span>
                        <span className="tabular font-mono text-label-xs text-ink-muted">
                          {c.productCount}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 font-label text-label font-semibold
                           uppercase tracking-[0.08em] text-ink transition-colors duration-fast hover:text-brand"
              >
                <span aria-hidden="true">←</span>
                Home
              </Link>
              <Link
                href="/c"
                className="inline-flex items-center gap-2 font-label text-label font-semibold
                           uppercase tracking-[0.08em] text-ink-subtle transition-colors duration-fast hover:text-brand"
              >
                The full index
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 font-label text-label font-semibold
                           uppercase tracking-[0.08em] text-ink-subtle transition-colors duration-fast hover:text-brand"
              >
                Report a broken link
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
