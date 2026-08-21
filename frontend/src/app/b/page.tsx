import type { Metadata } from "next";
import Link from "next/link";

import { getBrands, getCategories } from "@/lib/api";
import { brandHref } from "@/lib/format";
import type { Brand } from "@/lib/types";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export const metadata: Metadata = {
  title: "Brands",
  description: "Every brand PickDForYou covers, and how many of their products we have researched.",
  alternates: { canonical: "/b" },
};

/**
 * Brands index (spec §14).
 *
 * No brand in the catalogue has a logo asset, so the conventional treatment —
 * a grid of logo tiles — would render as a grid of empty boxes. Rather than
 * wait on assets, the brand NAME is the mark here, set large in the display
 * face. That is a deliberate editorial look rather than a placeholder, and it
 * has the useful property of staying correct when logos do arrive: a wordmark
 * set in our own type is a house style, not a missing image.
 *
 * Brands split by whether we have actually published anything on them, for the
 * same reason the category index shows its gaps.
 */
export default async function BrandsPage() {
  const [categories, brands] = await Promise.all([getCategories(), getBrands()]);

  const sorted = [...brands].sort(
    (a, b) => (b.productCount ?? 0) - (a.productCount ?? 0) || a.name.localeCompare(b.name),
  );
  const covered = sorted.filter((b) => (b.productCount ?? 0) > 0);
  const pending = sorted.filter((b) => (b.productCount ?? 0) === 0);
  const researched = covered.reduce((sum, b) => sum + (b.productCount ?? 0), 0);

  return (
    <>
      <SiteHeader categories={categories} />

      <main id="main">
        {/* --- Masthead ------------------------------------------------ */}
        <section className="relative overflow-hidden border-b border-line bg-bg">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

          <div className="shell relative py-12 lg:py-16">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Brands" }]} />

            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="max-w-3xl">
                <p className="t-eyebrow mb-4">The makers</p>
                <h1 className="t-display text-ink">Brands.</h1>
                <p className="mt-6 max-w-xl text-body-lg text-ink-muted">
                  Who makes the things we cover. Being listed here buys nothing — no brand can pay
                  to appear, and none of them get to see a verdict before you do.
                </p>
              </div>

              <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end">
                <Ledger value={brands.length} label="Brands" />
                <Ledger value={researched} label="Products researched" accent />
              </dl>
            </div>
          </div>
        </section>

        <div className="shell-wide pb-24 pt-14 lg:pt-20">
          {covered.length > 0 ? (
            <section aria-labelledby="covered">
              <h2 id="covered" className="t-eyebrow border-b border-line pb-5">
                With published research
              </h2>
              <div
                className="mt-8 grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))" }}
              >
                {covered.map((brand) => (
                  <BrandCard key={brand.id} brand={brand} />
                ))}
              </div>
            </section>
          ) : null}

          {pending.length > 0 ? (
            <section aria-labelledby="pending" className="mt-section">
              <h2 id="pending" className="t-eyebrow border-b border-line pb-5">
                Covered, nothing published yet
              </h2>
              <p className="mt-5 max-w-prose text-body-sm text-ink-muted">
                We have these on the list. Nothing appears against a brand until the research
                behind it is finished.
              </p>
              <div
                className="mt-8 grid gap-4"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(240px, 100%), 1fr))" }}
              >
                {pending.map((brand) => (
                  <BrandCard key={brand.id} brand={brand} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Ledger({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
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

function BrandCard({ brand }: { brand: Brand }) {
  const count = brand.productCount ?? 0;
  const researched = count > 0;

  return (
    <Link
      href={brandHref(brand.slug)}
      className="panel panel-raise group flex min-h-[9.5rem] flex-col justify-between p-5
                 transition-colors duration-fast ease-ease hover:border-brand-line hover:bg-brand-soft"
    >
      {/* The wordmark carries the card. Tight tracking and the display face is
          the same treatment the site logo gets, so a brand reads as a name
          rather than as a missing asset. */}
      <span
        className={`font-display text-headline-md font-bold tracking-[-0.03em] transition-colors duration-fast ${
          researched ? "text-ink group-hover:text-brand" : "text-ink-subtle group-hover:text-ink"
        }`}
      >
        {brand.name}
      </span>

      <span className="flex items-baseline justify-between gap-3">
        <span className="tabular font-mono text-label-xs text-ink-subtle">
          {researched ? `${count} researched` : "Not yet researched"}
        </span>
        <span
          className="translate-x-0 text-brand opacity-0 transition-all duration-fast ease-ease
                     group-hover:translate-x-1 group-hover:opacity-100"
          aria-hidden="true"
        >
          →
        </span>
      </span>
    </Link>
  );
}
