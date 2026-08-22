import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";

import { getBrands, getCategories } from "@/lib/api";
import { listProducts, listRetailers, safe } from "@/lib/admin-api";
import { isProductSort, type ProductSort } from "@/lib/product-sort";
import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import { timeAgo } from "@/lib/pricing";
import { StatusPill } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/product/ScoreRing";
import {
  AdminButton,
  AdminPage,
  DataTable,
  FilterTabs,
  Td,
} from "@/components/admin/Shell";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { ProductListControls } from "@/components/admin/ProductListControls";
import { AdminSearch } from "@/components/admin/AdminSearch";
import type { Paginated, ProductSummary } from "@/lib/types";
import { TableArriving, ValueArriving } from "@/components/ui/Arriving";

export const metadata: Metadata = { title: "Products", robots: { index: false } };
export const dynamic = "force-dynamic";

/** The tabs this screen offers; anything else falls back to "all". */
const STATUSES = new Set(["all", "published", "draft", "archived"]);

/** The price-state filters the API understands. */
const PRICE_STATES = new Set(["missing", "present", "failing"]);

/** The 8-4-4-4-12 shape. A hand-edited `?categoryId=' or 1=1` never reaches
 *  the API — not because it would work there, but because a malformed id
 *  produces a 422 that renders as an empty screen with no explanation. */
const ID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function idOrUndefined(value: string | undefined): string | undefined {
  return value && ID_RE.test(value) ? value : undefined;
}

/** A hand-edited `?page=abc` produced `page=NaN` upstream. */
function pageOf(value: string | undefined): number {
  const n = Math.floor(Number(value ?? 1));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

const EMPTY: Paginated<ProductSummary> = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
  hasMore: false,
};

/**
 * Product catalogue (spec §36).
 *
 * Unlike the public list this shows drafts and archived products — that is the
 * whole point of the screen. Publication state is the first thing the eye
 * should land on, so it gets a pill rather than a subtle marker.
 *
 * Sorting and filtering are wider here than on the public site because this is
 * a worklist, not a shop window: "newest first" is where an editor comes back
 * to, and "price checked longest ago" plus "last check failed" is how they
 * find what the last price run could not read.
 *
 * ---------------------------------------------------------------------------
 * The screen is assembled from four independent requests, and it used to await
 * all four before drawing anything — so the slowest of a product query, the
 * taxonomy, the brand list and the retailer list decided when an editor could
 * see the page at all.
 *
 * Only the two controls that read the query string are synchronous now: the
 * status tabs and the search field, which are the two things an editor is most
 * likely to reach for immediately and which must never wait on the rows they
 * are about to change. The count, the filter selects and the table each stream
 * behind their own boundary. The table's fallback holds its height and is
 * invisible for its first 420ms, so switching a tab on a warm cache shows no
 * loading state.
 */
export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    q?: string;
    page?: string;
    sort?: string;
    categoryId?: string;
    brandId?: string;
    retailer?: string;
    priceState?: string;
  }>;
}) {
  const sp = await searchParams;

  const status = STATUSES.has(sp.status ?? "") ? sp.status! : "all";
  const sort = isProductSort(sp.sort) ? sp.sort : "newest";
  const categoryId = idOrUndefined(sp.categoryId);
  const brandId = idOrUndefined(sp.brandId);
  const priceState = PRICE_STATES.has(sp.priceState ?? "") ? sp.priceState : undefined;
  const page = pageOf(sp.page);

  const query: Query = {
    status,
    q: sp.q,
    page,
    sort,
    categoryId,
    brandId,
    retailer: sp.retailer,
    priceState,
  };
  const key = JSON.stringify(query);

  return (
    <AdminPage
      title="Products"
      eyebrow="Content"
      description="Everything in the catalogue, including drafts. Only published products are visible publicly."
      actions={<AdminButton href="/admin/products/new">+ New product</AdminButton>}
    >
      <FilterTabs
        basePath="/admin/products"
        active={status}
        options={[
          { value: "all", label: "All" },
          { value: "published", label: "Published" },
          { value: "draft", label: "Drafts" },
          { value: "archived", label: "Archived" },
        ]}
      />

      <div className="my-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <AdminSearch placeholder="Search by title…" defaultValue={sp.q ?? ""} />
          <p className="tabular shrink-0 text-body-sm text-ink-subtle">
            <Suspense fallback={<ValueArriving width={12} />}>
              <Count query={query} />
            </Suspense>
          </p>
        </div>

        <Suspense fallback={<ControlsArriving />}>
          <Controls query={query} />
        </Suspense>
      </div>

      <Suspense key={key} fallback={<TableArriving rows={12} />}>
        <Catalogue query={query} />
      </Suspense>
    </AdminPage>
  );
}

type Query = {
  status: string;
  q: string | undefined;
  page: number;
  sort: ProductSort;
  categoryId: string | undefined;
  brandId: string | undefined;
  retailer: string | undefined;
  priceState: string | undefined;
};

/**
 * The count and the table are the same request; Next memoizes it per render
 * pass, so asking twice from two boundaries costs one call.
 */
async function products(query: Query) {
  return safe(
    () =>
      listProducts({
        status: query.status === "all" ? undefined : query.status,
        q: query.q,
        page: query.page,
        sort: query.sort,
        categoryId: query.categoryId,
        brandId: query.brandId,
        retailer: query.retailer,
        priceState: query.priceState,
      }),
    EMPTY,
  );
}

async function Count({ query }: { query: Query }) {
  const data = await products(query);
  return (
    <>
      {data.total} {data.total === 1 ? "product" : "products"}
    </>
  );
}

async function Controls({ query }: { query: Query }) {
  const [categories, brands, retailers] = await Promise.all([
    safe(() => getCategories(), []),
    safe(() => getBrands(), []),
    safe(() => listRetailers(), [] as { id: string; name: string; slug: string }[]),
  ]);

  return (
    <ProductListControls
      categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      retailers={retailers.map((r) => ({ slug: r.slug, name: r.name }))}
      current={{
        sort: query.sort,
        categoryId: query.categoryId,
        brandId: query.brandId,
        retailer: query.retailer,
        priceState: query.priceState,
      }}
    />
  );
}

/** The selects' own height, so the table below does not step down when the
 *  three lookups behind them land. */
function ControlsArriving() {
  return <div className="h-10" aria-hidden="true" />;
}

/** Carries every active filter into the next page. Dropping any of them makes
 *  "Load more" return page 2 of a different list. */
function nextPageQuery(query: Query, nextPage: number): string {
  const qs = new URLSearchParams({
    status: query.status,
    sort: query.sort,
    page: String(nextPage),
  });
  if (query.q) qs.set("q", query.q);
  if (query.categoryId) qs.set("categoryId", query.categoryId);
  if (query.brandId) qs.set("brandId", query.brandId);
  if (query.retailer) qs.set("retailer", query.retailer);
  if (query.priceState) qs.set("priceState", query.priceState);
  return qs.toString();
}

async function Catalogue({ query }: { query: Query }) {
  const data = await products(query);

  return (
    <>
      <DataTable
        columns={[
          "Product",
          "Brand / Category",
          "Price",
          "Score",
          "Status",
          "Price checked",
          "",
        ]}
        empty={data.items.length === 0}
      >
        {data.items.map((p) => (
          <tr key={p.id} className="transition-colors duration-fast hover:bg-surface-1">
            <Td>
              <div className="flex items-center gap-3">
                <div className="plate relative h-11 w-11 shrink-0 overflow-hidden rounded-sm border border-line">
                  {p.primaryImage?.url ? (
                    <Image
                      src={p.primaryImage.url}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <div className="dot-matrix h-full w-full" />
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="block truncate font-medium text-ink hover:text-brand"
                  >
                    {p.title}
                  </Link>
                  <span className="block truncate font-mono text-label-xs text-ink-faint">
                    /{p.slug}
                  </span>
                </div>
              </div>
            </Td>

            <Td>
              <p className="text-body-sm text-ink">{p.brand.name}</p>
              <p className="text-label-xs text-ink-faint">{p.category.name}</p>
            </Td>

            <Td mono>
              {p.pricing.current
                ? formatPrice(p.pricing.current, p.pricing.currency)
                : <span className="text-ink-faint">—</span>}
            </Td>

            <Td>
              {p.score ? (
                <ScoreRing score={p.score.overall} size="sm" showLabel={false} />
              ) : (
                <span className="text-ink-faint">—</span>
              )}
            </Td>

            <Td>
              <StatusPill status={p.status} />
            </Td>

            {/* This column read "—" for every row. It now answers the question
                the price runs exist to answer: is this number current? */}
            <Td className="whitespace-nowrap">
              <span
                title={
                  p.pricing.updatedAt
                    ? new Date(p.pricing.updatedAt).toLocaleString()
                    : "This product's price has never been checked."
                }
                className={cn(
                  "text-body-sm",
                  p.pricing.updatedAt ? "text-ink-subtle" : "text-ink-faint",
                )}
              >
                {timeAgo(p.pricing.updatedAt)}
              </span>
            </Td>

            <Td className="text-right">
              <ProductRowActions
                id={p.id}
                status={p.status}
                slug={p.slug}
                categorySlug={p.category.slug}
              />
            </Td>
          </tr>
        ))}
      </DataTable>

      {data.hasMore && (
        <div className="mt-6 flex justify-center">
          <Link
            href={`/admin/products?${nextPageQuery(query, query.page + 1)}`}
            className="inline-flex h-10 items-center rounded-full border border-line-strong px-6
                       font-label text-label-xs font-semibold uppercase tracking-[0.08em]
                       text-ink transition-colors duration-fast hover:border-brand hover:text-brand"
          >
            Load more
          </Link>
        </div>
      )}
    </>
  );
}
