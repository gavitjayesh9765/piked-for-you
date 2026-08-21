import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getBrand, getCategories, listProducts } from "@/lib/api";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductCard } from "@/components/product/ProductCard";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrand(slug);
  if (!brand) return { title: "Brand not found" };

  return {
    title: `${brand.name} — researched and ranked`,
    description:
      brand.description ?? `Every ${brand.name} product we have researched, with our verdict on each.`,
    alternates: { canonical: `/b/${slug}` },
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

  const [categories, brand] = await Promise.all([getCategories(), getBrand(slug)]);
  if (!brand) notFound();

  const { items: products } = await listProducts({
    brand: [slug],
    sort: "score_desc",
    pageSize: 48,
  });

  const scored = products.filter((p) => p.score?.overall != null);
  const average = scored.length
    ? (scored.reduce((s, p) => s + (p.score?.overall ?? 0), 0) / scored.length).toFixed(1)
    : "—";

  return (
    <>
      <SiteHeader categories={categories} />

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

              <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end">
                <Ledger value={String(products.length)} label="Researched" />
                <Ledger value={average} label="Average score" accent />
              </dl>
            </div>
          </div>
        </section>

        {/* --- Verdicts ------------------------------------------------ */}
        <div className="shell-wide pb-24 pt-14 lg:pt-20">
          {products.length > 0 ? (
            <>
              <h2 className="t-eyebrow border-b border-line pb-5">
                Our verdicts, highest scoring first
              </h2>
              <div className="grid-products mt-8">
                {products.map((p, i) => (
                  <ProductCard key={p.id} product={p} priority={i < 4} />
                ))}
              </div>
            </>
          ) : (
            <div className="shell-content py-16 text-center">
              <p className="t-eyebrow mb-4">Nothing published yet</p>
              <h2 className="t-headline text-ink">
                We cover {brand.name}. We have not finished a verdict yet.
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
        </div>
      </main>

      <SiteFooter />
    </>
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
