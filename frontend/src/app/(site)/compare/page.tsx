import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { getProduct, listProducts } from "@/lib/api";
import { formatPrice, productHref } from "@/lib/format";
import type { Product } from "@/lib/types";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ScoreRing } from "@/components/product/ScoreRing";
import { CommunityRating } from "@/components/ui/Badge";

type Search = { p?: string | string[] };

const TITLE = "Compare products";
const DESCRIPTION =
  "Put our verdicts side by side — scores, criteria, prices, and who each one is for.";

/**
 * The empty comparison tool is a real page and should rank for "compare X".
 * A comparison of three named products is a different matter.
 *
 * `?p=` is a combinatorial URL space — every ordered subset of the catalogue up
 * to `MAX`, which is already millions of resolvable URLs at a few hundred
 * products and grows cubically. Each renders real content, each canonicalises
 * here, and each one Google discovers is a fetch not spent on a product page.
 *
 * The canonical alone was doing half the job: it consolidates ranking onto
 * /compare, but consolidation happens AFTER the crawl, so it never reduces the
 * crawl. `noindex, follow` is the other half — do not keep these, but do walk
 * the product links on them, so a shared comparison still passes discovery
 * through to the pages we want indexed. app/robots.ts declines the crawl
 * earlier for crawlers that read it; this catches the ones that arrive anyway
 * from a shared link, which is exactly how these URLs spread.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const isComparison = Boolean(sp.p);

  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: "/compare" },
    ...(isComparison ? { robots: { index: false, follow: true } } : {}),
    openGraph: { title: TITLE, description: DESCRIPTION, url: "/compare", type: "website" },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

const MAX = 3;

/**
 * Compare (spec §31).
 *
 * Two decisions worth recording.
 *
 * First, this compares what we actually hold. The obvious build is a
 * specification table, but `specifications` is empty for every product in the
 * catalogue right now, so that page would be an elegant grid of blanks. The
 * comparison is built on the score criteria, the verdict, and the fit lists —
 * which are populated, and which are the part a reader cannot get from a
 * retailer anyway. Spec groups render underneath if and when they arrive.
 *
 * Second, it refuses to compare across categories. Our own methodology says a
 * 9.0 headphone and a 9.0 laptop are not the same currency, so quietly drawing
 * them in one table would contradict the page that explains the score. It says
 * so instead.
 *
 * Selection is a plain query string of `category/slug` pairs, so the whole page
 * stays a server component and a comparison stays linkable.
 */
export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const sp = await searchParams;
  const keys = (Array.isArray(sp.p) ? sp.p : sp.p ? [sp.p] : [])
    .filter((k) => /^[a-z0-9-]+\/[a-z0-9-]+$/i.test(k))
    .slice(0, MAX);

  const fetched = await Promise.all(
    keys.map((k) => {
      const [cat, slug] = k.split("/");
      return getProduct(cat, slug);
    }),
  );

  const products = fetched.filter((p): p is Product => p != null);

  // Our own rubric is per-category, so a cross-category table would be
  // presenting incomparable numbers as comparable.
  const categorySlugs = new Set(products.map((p) => p.category.slug));
  const mixed = categorySlugs.size > 1;

  return (
    <main id="main">
      <section className="relative overflow-hidden border-b border-line bg-bg">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="shell relative py-12 lg:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Compare" }]} />
          <div className="mt-8 max-w-3xl">
            <p className="t-eyebrow mb-4">Side by side</p>
            <h1 className="t-display text-ink">Compare.</h1>
            <p className="mt-6 max-w-xl text-body-lg text-ink-muted">
              Put our verdicts next to each other. Up to {MAX} at a time, from the same category
              — because that is the only way the scores mean anything.
            </p>
          </div>
        </div>
      </section>

      <div className="shell-wide pb-24 pt-14 lg:pt-20">
        {products.length === 0 ? (
          <Picker selected={keys} heading="Pick something to compare" />
        ) : mixed ? (
          <MixedCategories products={products} />
        ) : (
          <>
            <ComparisonTable products={products} />
            {products.length < MAX ? (
              <div className="mt-section">
                <Picker
                  selected={keys}
                  heading="Add another"
                  categorySlug={products[0].category.slug}
                />
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>

  );
}

/* ------------------------------------------------------------------ */
/* Comparison                                                          */
/* ------------------------------------------------------------------ */

function ComparisonTable({ products }: { products: Product[] }) {
  // Only criteria every selected product was scored on. A row that is blank for
  // one column invites a comparison that was never made.
  const shared = products[0].score?.criteria ?? [];
  const common = shared.filter((c) =>
    products.every((p) => p.score?.criteria?.some((x) => x.key === c.key)),
  );

  const cols = `repeat(${products.length}, minmax(0, 1fr))`;

  return (
    <div className="overflow-x-auto">
      {/* The floor scales with the number of columns instead of being a flat
          42rem. Two products now fit inside a phone with no sideways scroll at
          all; three still scroll, which is the honest outcome — but a reader
          comparing a pair should not have to drag the page to see the second
          one. */}
      <div style={{ minWidth: `${products.length * 9.5}rem` }}>
        {/* --- Heads ------------------------------------------------- */}
        <div
          className="grid gap-4 border-b border-line pb-6 sm:gap-6"
          style={{ gridTemplateColumns: cols }}
        >
          {products.map((p) => (
            <div key={p.id}>
              <div className="plate relative mb-4 aspect-[16/9] overflow-hidden rounded-md">
                {p.primaryImage ? (
                  <Image
                    src={p.primaryImage.url}
                    alt=""
                    fill
                    sizes="33vw"
                    className="object-contain p-5"
                  />
                ) : (
                  <div className="dot-matrix h-full w-full" />
                )}
              </div>

              <span className="t-eyebrow">{p.brand.name}</span>
              <h2 className="mt-1.5 text-headline-sm text-ink">
                <Link
                  href={productHref(p)}
                  className="transition-colors duration-fast hover:text-brand"
                >
                  {p.title}
                </Link>
              </h2>

              <div className="mt-4 flex items-center gap-4">
                {p.score ? <ScoreRing score={p.score.overall} size="sm" showLabel={false} /> : null}
                <span className="tabular text-headline-sm font-bold text-ink">
                  {formatPrice(p.pricing.current, p.pricing.currency)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* --- Criteria ---------------------------------------------- */}
        {common.length > 0 ? (
          <Block title="Our scoring">
            {common.map((c) => {
              const values = products.map(
                (p) => p.score?.criteria.find((x) => x.key === c.key)?.value ?? 0,
              );
              const top = Math.max(...values);
              // A tie is not a win. Highlighting every column when the scores
              // are level reads as a sweep, so only a unique high is marked.
              const best = values.filter((v) => v === top).length === 1 ? top : null;
              return (
                <div key={c.key} className="border-b border-line-faint py-4 last:border-b-0">
                  <p className="mb-3 text-body-sm text-ink-subtle">{c.label}</p>
                  <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: cols }}>
                    {values.map((v, i) => (
                      <div key={products[i].id}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`tabular font-mono text-label-xs ${
                              best !== null && v === best ? "text-brand" : "text-ink-muted"
                            }`}
                          >
                            {v.toFixed(1)}
                            <span className="text-ink-faint"> / 10</span>
                          </span>
                        </div>
                        <div className="mt-2 h-[2px] w-full bg-line">
                          <div
                            className={
                              best !== null && v === best
                                ? "h-full bg-brand"
                                : "h-full bg-line-strong"
                            }
                            style={{ width: `${Math.min(Math.max(v, 0), 10) * 10}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </Block>
        ) : null}

        {/* --- Verdict ----------------------------------------------- */}
        <Block title="Our verdict">
          <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: cols }}>
            {products.map((p) => (
              <p key={p.id} className="text-body-sm text-ink-muted">
                {p.verdict || p.tagline}
              </p>
            ))}
          </div>
        </Block>

        {/* --- Fit ---------------------------------------------------- */}
        <Block title="Best for">
          <ListRow products={products} pick={(p) => p.bestFor} tone="value" />
        </Block>

        <Block title="Not ideal for">
          <ListRow products={products} pick={(p) => p.notIdealFor} tone="muted" />
        </Block>

        <Block title="Pros">
          <ListRow products={products} pick={(p) => p.pros} tone="value" />
        </Block>

        <Block title="Cons">
          <ListRow products={products} pick={(p) => p.cons} tone="muted" />
        </Block>

        {/* --- Community --------------------------------------------- */}
        <Block title="What owners say">
          <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: cols }}>
            {products.map((p) =>
              p.communityRating && p.communityRating.count > 0 ? (
                <CommunityRating
                  key={p.id}
                  average={p.communityRating.average}
                  count={p.communityRating.count}
                />
              ) : (
                <span key={p.id} className="text-body-sm text-ink-faint">
                  No ratings yet
                </span>
              ),
            )}
          </div>
        </Block>

        {/* --- Specifications, when they exist ------------------------ */}
        {products.some((p) => p.specifications.length > 0) ? (
          <Block title="Specifications">
            <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: cols }}>
              {products.map((p) => (
                <div key={p.id}>
                  {p.specifications.length === 0 ? (
                    <span className="text-body-sm text-ink-faint">Not recorded</span>
                  ) : (
                    p.specifications.map((g) => (
                      <div key={g.label} className="mb-5">
                        <p className="t-eyebrow mb-2">{g.label}</p>
                        <dl>
                          {g.items.map((it) => (
                            <div
                              key={it.label}
                              className="flex justify-between gap-3 border-b border-line-faint py-1.5 last:border-b-0"
                            >
                              <dt className="text-body-sm text-ink-subtle">{it.label}</dt>
                              <dd className="text-body-sm text-ink">{it.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </Block>
        ) : null}
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h3 className="t-eyebrow border-b border-line pb-4">{title}</h3>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ListRow({
  products,
  pick,
  tone,
}: {
  products: Product[];
  pick: (p: Product) => string[];
  tone: "value" | "muted";
}) {
  const cols = `repeat(${products.length}, minmax(0, 1fr))`;
  return (
    <div className="grid gap-4 sm:gap-6" style={{ gridTemplateColumns: cols }}>
      {products.map((p) => {
        const items = pick(p);
        return (
          <ul key={p.id}>
            {items.length === 0 ? (
              <li className="text-body-sm text-ink-faint">—</li>
            ) : (
              items.map((item) => (
                <li key={item} className="flex gap-2.5 py-1.5 text-body-sm text-ink-muted">
                  <span
                    className={`mt-[0.62em] h-px w-3 shrink-0 ${
                      tone === "value" ? "bg-value" : "bg-line-strong"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))
            )}
          </ul>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

function MixedCategories({ products }: { products: Product[] }) {
  const names = [...new Set(products.map((p) => p.category.name))];
  return (
    <div className="shell-content py-12 text-center">
      <p className="t-eyebrow mb-4">Not comparable</p>
      <h2 className="t-headline text-ink">These are in different categories.</h2>
      <p className="mx-auto mt-5 max-w-lg text-body-md text-ink-muted">
        You have picked from {names.join(" and ")}. Every SortedChoice Score is built from a rubric
        specific to its category, so putting these numbers in one table would imply a comparison
        that our own method says is meaningless.{" "}
        <Link
          href="/how-we-research"
          className="text-brand underline decoration-brand-line underline-offset-4
                     transition-colors duration-fast hover:decoration-brand"
        >
          Why that is
        </Link>
        .
      </p>
      <Link
        href="/compare"
        className="mt-8 inline-flex items-center gap-2 font-label text-label font-semibold
                   uppercase tracking-[0.08em] text-brand transition-colors duration-fast hover:text-ink"
      >
        Start again
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/**
 * Selection without client JS: each option is a link that appends itself to the
 * query. Keeps the page a server component and keeps a comparison shareable.
 */
async function Picker({
  selected,
  heading,
  categorySlug,
}: {
  selected: string[];
  heading: string;
  categorySlug?: string;
}) {
  const { items } = await listProducts({
    ...(categorySlug ? { category: categorySlug } : {}),
    sort: "score_desc",
    pageSize: 24,
  });

  const available = items.filter((p) => !selected.includes(`${p.category.slug}/${p.slug}`));

  if (available.length === 0) {
    return (
      <p className="text-body-md text-ink-muted">
        Nothing else in this category is published yet.
      </p>
    );
  }

  return (
    <section aria-labelledby="picker">
      <h2 id="picker" className="t-eyebrow border-b border-line pb-5">
        {heading}
      </h2>
      <ul className="mt-1">
        {available.map((p) => {
          const key = `${p.category.slug}/${p.slug}`;
          const params = new URLSearchParams();
          [...selected, key].forEach((k) => params.append("p", k));

          return (
            <li key={p.id} className="border-b border-line-faint last:border-b-0">
              <Link
                href={`/compare?${params}`}
                className="group flex items-center justify-between gap-4 py-3.5"
              >
                <span className="flex min-w-0 items-baseline gap-2.5">
                  <span className="t-eyebrow shrink-0">{p.brand.name}</span>
                  <span className="truncate text-body-md text-ink transition-colors duration-fast group-hover:text-brand">
                    {p.title}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-4">
                  <span className="tabular font-mono text-label-xs text-ink-muted">
                    {p.score ? p.score.overall.toFixed(1) : "—"}
                  </span>
                  <span
                    className="text-brand opacity-0 transition-all duration-fast ease-ease
                               group-hover:translate-x-1 group-hover:opacity-100"
                    aria-hidden="true"
                  >
                    +
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
