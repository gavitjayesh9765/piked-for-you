import type { Metadata } from "next";
import Link from "next/link";

import { listSaved, safe } from "@/lib/me-api";
import { ProductCard } from "@/components/product/ProductCard";
import { EmptyState } from "@/components/admin/Shell";

export const metadata: Metadata = { title: "Saved", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * The user's shortlist.
 *
 * Deliberately *not* a cart. PickDForYou sells nothing (spec §56) — this is a
 * research shortlist, things you are still deciding between. The copy says so
 * rather than borrowing shopping-basket language.
 *
 * A saved product that has since been unpublished stays in the list — the user
 * chose to save it — but is marked unavailable rather than silently vanishing.
 */
export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp = await searchParams;
  const page = Number(sp.page ?? 1);

  const saved = await safe(() => listSaved(page), {
    items: [],
    total: 0,
    page: 1,
    pageSize: 24,
    hasMore: false,
  });

  return (
    <div>
      <header className="mb-8 border-b border-line pb-6">
        <p className="t-eyebrow mb-2">Your shortlist</p>
        <h1 className="font-display text-display-lg text-ink">Saved</h1>
        <p className="mt-3 max-w-xl text-body-md text-ink-muted">
          Products you&apos;re still deciding between. We don&apos;t sell anything — when
          you&apos;ve chosen, we hand you to a retailer.
        </p>
      </header>

      {saved.items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Tap Save on any product to keep it here while you decide."
          action={
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-full bg-brand-fill px-7 font-label
                         text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                         shadow-brand transition-all duration-fast hover:brightness-110"
            >
              Browse products
            </Link>
          }
        />
      ) : (
        <>
          <p className="tabular mb-6 text-body-sm text-ink-subtle">
            {saved.total} {saved.total === 1 ? "product" : "products"}
          </p>

          <div className="grid-products">
            {saved.items.map((item) => (
              <div key={item.id} className="relative">
                <ProductCard product={item.product} />
                {item.product.status !== "published" && (
                  <p className="mt-2 font-label text-label-xs uppercase tracking-[0.1em] text-warn">
                    No longer available
                  </p>
                )}
                {item.note && (
                  <p className="mt-2 rounded-md border border-line bg-surface-1 px-3 py-2 text-body-sm text-ink-muted">
                    {item.note}
                  </p>
                )}
              </div>
            ))}
          </div>

          {saved.hasMore && (
            <div className="mt-10 flex justify-center">
              <Link
                href={`/account/saved?page=${page + 1}`}
                className="inline-flex h-11 items-center rounded-full border border-line-strong px-7
                           font-label text-label-xs font-semibold uppercase tracking-[0.08em]
                           text-ink transition-colors duration-fast hover:border-brand hover:text-brand"
              >
                Load more
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
