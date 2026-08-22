import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getAlternatives, getProduct, getReviews } from "@/lib/api";
import type { Product } from "@/lib/types";
import { getAuthedUser } from "@/lib/supabase/server";
import { discountPercent, formatPrice, formatPriceRange } from "@/lib/format";

import { Section, SectionHeader } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { jsonLd } from "@/lib/json-ld";
import { Badge, CommunityRating } from "@/components/ui/Badge";
import { RetailButton } from "@/components/ui/Button";
import { Gallery } from "@/components/product/Gallery";
import { ScoreBreakdown, ScoreRing } from "@/components/product/ScoreRing";
import { AudienceFit, ProsCons, SpecTable, VerdictBlock } from "@/components/product/Verdict";
import { ProductCard } from "@/components/product/ProductCard";
import { ReviewList } from "@/components/product/ReviewList";
import { RowsArriving } from "@/components/ui/Arriving";

type Params = { category: string; slug: string };

/** SEO per spec §47 — title, description, canonical, OG, structured data. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category, slug } = await params;
  const product = await getProduct(category, slug);
  if (!product) return { title: "Product not found" };

  const title = product.seo?.metaTitle ?? `${product.brand.name} ${product.title}`;
  const description = product.seo?.metaDescription ?? product.tagline;

  return {
    title,
    description,
    alternates: { canonical: `/p/${category}/${slug}` },
    openGraph: {
      title,
      description,
      images: product.primaryImage ? [product.primaryImage.url] : undefined,
      type: "article",
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { category, slug } = await params;

  const product = await getProduct(category, slug);
  // A draft or archived product must be unreachable publicly (spec §38, §61).
  // The API enforces this too; this is defence in depth, not the control.
  if (!product || product.status !== "published") notFound();

  const off = discountPercent(product.pricing.current, product.pricing.max);
  const activeRetailers = product.retailers.filter((r) => r.isActive);

  return (
    <>
      <main id="main">
        <div className="shell-wide pt-6">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              ...product.category.path.map((seg, i, arr) => ({
                label: i === arr.length - 1 ? product.category.name : seg.replace(/-/g, " "),
                href: `/c/${arr.slice(0, i + 1).join("/")}`,
              })),
              { label: product.title },
            ]}
          />
        </div>

        {/* ================= Above the fold: gallery + decision panel =========
            Full-bleed two-column. The gallery gets the larger share on wide
            displays; the decision column is capped so it never sprawls. */}
        <div className="shell-wide mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] xl:gap-16">
          {/* Images and linked videos share one filmstrip — to a reader
              deciding what to buy they are the same thing: another look. */}
          <Gallery images={[...product.images, ...product.videos]} title={product.title} />

          <div className="flex max-w-3xl flex-col">
            {/* `gap-4` on a phone: a 76px ring, a 24px gap and a 36px headline
                leave under 230px of measure inside a 360px viewport, which is
                where a model number like "WH-1000XM5" starts overflowing.
                `[overflow-wrap:anywhere]` is the backstop for the titles that
                are one unbreakable token. */}
            <div className="flex items-start justify-between gap-4 sm:gap-6">
              <div className="min-w-0">
                <Link
                  href={`/b/${product.brand.slug}`}
                  className="t-eyebrow transition-colors duration-fast hover:text-brand"
                >
                  {product.brand.name}
                </Link>
                <h1 className="mt-2 font-display text-display-lg text-ink [overflow-wrap:anywhere]">
                  {product.title}
                </h1>
                {product.shortDescription && (
                  <p className="mt-3 text-body-md text-ink-muted sm:text-body-lg">
                    {product.shortDescription}
                  </p>
                )}
              </div>
              {product.score && (
                <>
                  <ScoreRing score={product.score.overall} size="md" className="shrink-0 sm:hidden" />
                  <ScoreRing
                    score={product.score.overall}
                    size="lg"
                    className="hidden shrink-0 sm:flex"
                  />
                </>
              )}
            </div>

            {product.badges.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {product.badges.map((b) => (
                  <Badge key={b.id} badge={b} size="sm" />
                ))}
              </div>
            )}

            {/* --- Price block (spec §20) --- */}
            <div className="mt-7 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-line pt-7 sm:mt-8 sm:pt-8">
              <span className="tabular text-display-lg font-bold leading-none text-ink">
                {formatPrice(product.pricing.current, product.pricing.currency)}
              </span>
              {product.pricing.min != null && product.pricing.max != null && (
                <span className="tabular text-body-sm text-ink-subtle">
                  Range {formatPriceRange(product.pricing.min, product.pricing.max, product.pricing.currency)}
                </span>
              )}
              {off && (
                <span className="rounded-xs border border-value-line bg-value-soft px-2.5 py-1 font-label text-label-xs font-bold uppercase tracking-[0.1em] text-value-on-soft">
                  {off}% below peak
                </span>
              )}
            </div>

            {product.communityRating && product.communityRating.count > 0 && (
              <CommunityRating
                average={product.communityRating.average}
                count={product.communityRating.count}
                className="mt-4"
              />
            )}

            {/* --- Retailer exits (spec §26). The only orange on the page. --- */}
            <div className="mt-8 flex flex-col gap-3">
              {activeRetailers.map((r, i) => (
                <RetailButton
                  key={r.id}
                  retailer={r.retailer}
                  href={r.url}
                  price={r.displayPrice ? formatPrice(r.displayPrice, product.pricing.currency) : undefined}
                  emphasis={i === 0 ? "primary" : "secondary"}
                />
              ))}
              <p className="text-label-xs leading-relaxed text-ink-faint">
                PickDForYou does not sell this product. Prices are indicative and last checked
                separately by each retailer — confirm on their site before buying.
              </p>
            </div>

            {/* --- Score breakdown (spec §24) --- */}
            {product.score && product.score.criteria.length > 0 && (
              <div className="panel mt-8 p-5 sm:p-6">
                <div className="flex items-baseline justify-between">
                  <h2 className="t-eyebrow text-brand">PickD Score breakdown</h2>
                  <span className="tabular text-headline-sm font-bold text-ink">
                    {(Number(product.score.overall) || 0).toFixed(1)}
                    <span className="text-body-sm font-normal text-ink-subtle"> / 10</span>
                  </span>
                </div>
                <ScoreBreakdown criteria={product.score.criteria} className="mt-5" />
              </div>
            )}
          </div>
        </div>

        {/* ================= The research =================
            One region, not four. Each of these blocks used to be its own
            <Section>, so a full section gap sat between a verdict and the pros
            that argue it — the page read as unrelated islands with dead air
            between them.

            The reading column carries the judgement (verdict, then pros and
            cons); the rail beside it carries the reference a reader dips into
            (who it suits, then the numbers). Capped narrower than the hero on
            purpose — the hero is a grid and wants the width, this is prose and
            does not (docs/01-design-brainstorm.md §3.2). */}
        <div className="shell-wide mt-section">
          <div className="mx-auto grid max-w-[1240px] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:gap-6">
            <div className="flex min-w-0 flex-col gap-5">
              {product.verdict && <VerdictBlock verdict={product.verdict} />}
              <ProsCons pros={product.pros} cons={product.cons} className="grid gap-5 md:grid-cols-2" />
            </div>

            <aside className="flex flex-col gap-5">
              <AudienceFit
                bestFor={product.bestFor}
                notIdealFor={product.notIdealFor}
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1"
              />

              {product.specifications.length > 0 && (
                <div>
                  <h2 className="t-eyebrow mb-3">Specifications</h2>
                  <SpecTable groups={product.specifications} />
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* ================= Community =================

            Reviews and the viewer's session are both below the fold and both
            cost a round trip, so neither belongs in front of the verdict. The
            reader is reading the review we wrote while these arrive. */}
        <Suspense
          fallback={
            <Section width="wide">
              <RowsArriving rows={3} />
            </Section>
          }
        >
          <Community product={product} />
        </Suspense>

        {/* ================= Alternatives (spec §52) ================= */}
        <Suspense fallback={null}>
          <Alternatives productId={product.id} />
        </Suspense>
      </main>

      {/* Structured data (spec §47). Uses the community rating, never the PickD
          Score — aggregateRating has a defined meaning and conflating our
          editorial score with it would misrepresent both. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "Product",
            name: `${product.brand.name} ${product.title}`,
            description: product.tagline,
            brand: { "@type": "Brand", name: product.brand.name },
            image: product.images.map((i) => i.url),
            ...(product.communityRating && product.communityRating.count > 0
              ? {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: product.communityRating.average,
                    reviewCount: product.communityRating.count,
                    bestRating: 5,
                  },
                }
              : {}),
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: product.pricing.currency,
              lowPrice: product.pricing.min ?? product.pricing.current,
              highPrice: product.pricing.max ?? product.pricing.current,
              offerCount: activeRetailers.length,
            },
          }),
        }}
      />
    </>
  );
}

/**
 * Everything below the verdict, streamed.
 *
 * Splitting these out is what took `getReviews`, `getAlternatives` and
 * `getAuthedUser` off the critical path. All three used to be awaited in one
 * `Promise.all` before the page rendered, so the product's own images, score
 * and verdict — already fetched and ready — waited on the slowest of a review
 * query, a similarity query and an auth round trip before appearing.
 */
async function Community({ product }: { product: Product }) {
  const [reviews, viewer] = await Promise.all([getReviews(product.id), getAuthedUser()]);

  return (
    <Section width="wide">
      <ReviewList
        reviews={reviews.items}
        average={product.communityRating?.average}
        count={product.communityRating?.count}
        productId={product.id}
        productTitle={`${product.brand.name} ${product.title}`}
        isAuthed={Boolean(viewer)}
      />
    </Section>
  );
}

async function Alternatives({ productId }: { productId: string }) {
  const alternatives = await getAlternatives(productId, 5);
  if (alternatives.length === 0) return null;

  return (
    <Section width="wide">
      <SectionHeader
        title="Alternatives worth considering"
        subtitle="Similar products we've researched, in case this one isn't the right fit."
      />
      <div className="grid-products stagger mt-8">
        {alternatives.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </Section>
  );
}
