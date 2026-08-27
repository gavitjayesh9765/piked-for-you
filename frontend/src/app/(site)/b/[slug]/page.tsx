import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Suspense } from "react";

import { getBrand, listProducts } from "@/lib/api";
import type { Brand } from "@/lib/types";
import { ProductGridArriving, ValueArriving } from "@/components/ui/Arriving";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductCard } from "@/components/product/ProductCard";
import { CollectionPageJsonLd } from "@/components/seo/CollectionPageJsonLd";
import { ItemListJsonLd, itemListId } from "@/components/seo/ItemListJsonLd";
import { brandDescription, brandTitle } from "@/lib/seo";
import { absoluteUrl } from "@/lib/site";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);
  // Same reasoning as the product and category pages: a brand that does not
  // exist must not leave an indexable page behind at the URL someone guessed.
  // This used to return a bare title and inherit `robots: index` from the root.
  if (!brand) return { title: "Brand not found", robots: { index: false, follow: false } };

  const title = brandTitle(brand);
  const description = brandDescription(brand);
  const canonical = `/b/${slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "website" },
    // See the note on the category page: card SIZE is the one thing Twitter
    // does not inherit from Open Graph, and a route declaring its own
    // `openGraph` does not inherit the root layout's `twitter` block either.
    twitter: { card: "summary_large_image", title, description },
  };
}

/**
 * Brand page (spec §14).
 *
 * A brand page on a shop is a storefront. This one is a body of work: what we
 * have concluded about this maker so far, and nothing else. There is no brand
 * copy, no hero image supplied by the manufacturer, and no marketing language
 * — a brand does not get to write its own page here, which is the whole point
 * of the site.
 */
export default async function BrandPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;

  const brand = await getBrand(slug);
  if (!brand) notFound();

  return (
    <main id="main">
      {/* --- Masthead ------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-line bg-bg">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

        <div className="shell relative py-12 lg:py-16">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Brands", href: "/b" },
              { label: brand.name },
            ]}
          />

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="t-eyebrow mb-4">The makers</p>
              <h1 className="t-display text-ink">{brand.name}</h1>

              {brand.description ? (
                <p className="mt-6 max-w-xl text-body-lg text-ink-muted">{brand.description}</p>
              ) : (
                <p className="mt-6 max-w-xl text-body-lg text-ink-muted">
                  Everything from {brand.name} we have researched so far, with our verdict on
                  each.
                </p>
              )}

              {brand.website ? (
                <a
                  href={brand.website}
                  rel="nofollow noopener noreferrer"
                  target="_blank"
                  className="mt-6 inline-flex items-center gap-2 font-label text-label font-semibold
                             uppercase tracking-[0.08em] text-ink-subtle transition-colors
                             duration-fast hover:text-brand"
                >
                  Manufacturer site
                  <span aria-hidden="true">↗</span>
                </a>
              ) : null}
            </div>

            <Suspense fallback={<LedgerArriving />}>
              <Ledgers slug={slug} />
            </Suspense>
          </div>
        </div>
      </section>

      {/* --- Verdicts --- */}
      <Suspense
        fallback={
          <div className="shell-wide pb-24 pt-14 lg:pt-20">
            <ProductGridArriving count={4} />
          </div>
        }
      >
        <Verdicts slug={slug} brand={brand} />
      </Suspense>
    </main>
  );
}

function Ledger({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div>
      <dd
        className={`tabular font-display text-headline-lg font-bold leading-none ${
          accent ? "text-brand" : "text-ink"
        }`}
      >
        {value}
      </dd>
      <dt className="t-eyebrow mt-2.5">{label}</dt>
    </div>
  );
}

/**
 * A brand's own record answers the masthead — its name, its description, the
 * breadcrumb — and that is one cheap lookup. Counting and ranking its products
 * is a second, heavier query that nothing above the fold depends on, so it
 * streams. Both halves below share one memoized `listProducts` call.
 */
async function brandProducts(slug: string) {
  const { items } = await listProducts({ brand: [slug], sort: "score_desc", pageSize: 48 });
  return items;
}

async function Ledgers({ slug }: { slug: string }) {
  const products = await brandProducts(slug);
  const scored = products.filter((p) => p.score?.overall != null);
  const average = scored.length
    ? (scored.reduce((s, p) => s + (p.score?.overall ?? 0), 0) / scored.length).toFixed(1)
    : "—";

  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end">
      <Ledger value={String(products.length)} label="Researched" />
      <Ledger value={average} label="Average score" accent />
    </dl>
  );
}

function LedgerArriving() {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end">
      {["Researched", "Average score"].map((label) => (
        <div key={label}>
          <dd className="tabular font-display text-headline-lg font-bold leading-none text-ink">
            <ValueArriving width={3} />
          </dd>
          <dt className="t-eyebrow mt-2.5">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

async function Verdicts({ slug, brand }: { slug: string; brand: Brand }) {
  const products = await brandProducts(slug);
  const brandName = brand.name;
  const path = `/b/${slug}`;

  return (
    <div className="shell-wide pb-24 pt-14 lg:pt-20">
      {products.length > 0 ? (
        <>
          <h2 className="t-eyebrow border-b border-line pb-5">
            Our verdicts, highest scoring first
          </h2>
          <div className="grid-products stagger mt-8">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </>
      ) : (
        <div className="shell-content py-16 text-center">
          <p className="t-eyebrow mb-4">Nothing published yet</p>
          <h2 className="t-headline text-ink">
            We cover {brandName}. We have not finished a verdict yet.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-body-md text-ink-muted">
            This page fills up when the research does. We would rather leave it empty than pad
            it with a page of specifications you can read anywhere.
          </p>
          <Link
            href="/c"
            className="mt-8 inline-flex items-center gap-2 font-label text-label font-semibold
                       uppercase tracking-[0.08em] text-brand transition-colors duration-fast hover:text-ink"
          >
            Browse the index
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}

      {/* --- Structured data ----------------------------------------------
          This page had none, which made it the largest untyped surface left on
          the site: one page per manufacturer, each one an ordered set of our
          verdicts, all of it legible only as prose and anchor tags.

          Three nodes, each doing a different job:

            CollectionPage — what this page is and who published it.
            ItemList       — the ranking on it, highest scoring first, which is
                             an editorial claim and not an arbitrary sort.
            Brand          — the manufacturer as an ENTITY, so `about` resolves
                             to something rather than to a string.

          The Brand node is the one worth arguing for. Every product page
          already emits `brand: { "@type": "Brand", name }` — an anonymous node,
          repeated once per product, that no crawler can tell is the same maker
          each time. This page is the natural home for the canonical one, since
          it is the only URL on the site that is ABOUT a brand, and giving it
          `@id` plus `url` plus the manufacturer's own site is what lets Google
          reconcile our "Sony" with the Sony it already knows about.

          `sameAs` carries the manufacturer's website where we have one. Note
          the page renders that same link with `rel="nofollow"` — deliberately,
          since we do not vouch for a manufacturer's marketing — and there is no
          contradiction: `nofollow` withholds ranking endorsement from a link,
          while `sameAs` states an identity fact. They are different claims. */}
      {products.length > 0 && (
        <ItemListJsonLd
          products={products}
          path={path}
          name={`${brandName} products, ranked by our score`}
        />
      )}
      <CollectionPageJsonLd
        path={path}
        name={brandTitle(brand)}
        description={brandDescription(brand)}
        {...(products.length > 0 ? { itemListId: itemListId(path) } : {})}
        about={{
          "@type": "Brand",
          "@id": `${absoluteUrl(path)}#brand`,
          name: brandName,
          url: absoluteUrl(path),
          ...(brand.logoUrl ? { logo: brand.logoUrl } : {}),
          ...(brand.website ? { sameAs: [brand.website] } : {}),
        }}
      />
    </div>
  );
}
