import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAlternatives, getCategories, getProduct, getReviews } from "@/lib/api";
import { getAuthedUser } from "@/lib/supabase/server";
import { discountPercent, formatPrice, formatPriceRange } from "@/lib/format";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Section, SectionHeader } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Badge, CommunityRating } from "@/components/ui/Badge";
import { RetailButton } from "@/components/ui/Button";
import { Gallery } from "@/components/product/Gallery";
import { ScoreBreakdown, ScoreRing } from "@/components/product/ScoreRing";
import { AudienceFit, ProsCons, SpecTable, VerdictBlock } from "@/components/product/Verdict";
import { ProductCard } from "@/components/product/ProductCard";
import { ReviewList } from "@/components/product/ReviewList";

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

  const [product, categories] = await Promise.all([getProduct(category, slug), getCategories()]);
  // A draft or archived product must be unreachable publicly (spec §38, §61).
  // The API enforces this too; this is defence in depth, not the control.
  if (!product || product.status !== "published") notFound();

  const [reviews, alternatives, viewer] = await Promise.all([
    getReviews(product.id),
    getAlternatives(product.id, 5),
    getAuthedUser(),
  ]);

  const off = discountPercent(product.pricing.current, product.pricing.max);
  const activeRetailers = product.retailers.filter((r) => r.isActive);

  return (
    <>
      <SiteHeader categories={categories} />

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

          <div className="flex max-w-2xl flex-col">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <Link
                  href={`/b/${product.brand.slug}`}
                  className="t-eyebrow transition-colors duration-fast hover:text-brand"
                >
                  {product.brand.name}
                </Link>
                <h1 className="mt-2 font-display text-display-lg text-ink">{product.title}</h1>
                {product.shortDescription && (
                  <p className="mt-3 text-body-lg text-ink-muted">{product.shortDescription}</p>
                )}
              </div>
              {product.score && <ScoreRing score={product.score.overall} size="lg" className="shrink-0" />}
            </div>

            {product.badges.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {product.badges.map((b) => (
                  <Badge key={b.id} badge={b} size="sm" />
                ))}
              </div>
            )}

            {/* --- Price block (spec §20) --- */}
            <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t border-line pt-8">
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
              <div className="panel mt-8 p-6">
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

        {/* ================= The research ================= */}
        {product.verdict && (
          <Section width="wide">
            <VerdictBlock verdict={product.verdict} />
          </Section>
        )}

        <Section width="wide">
          <AudienceFit bestFor={product.bestFor} notIdealFor={product.notIdealFor} />
        </Section>

        <Section width="wide">
          <ProsCons pros={product.pros} cons={product.cons} />
        </Section>

        {product.specifications.length > 0 && (
          <Section width="wide">
            <SectionHeader title="Specifications" />
            <div className="mt-8">
              <SpecTable groups={product.specifications} />
            </div>
          </Section>
        )}

        {/* ================= Community ================= */}
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

        {/* ================= Alternatives (spec §52) ================= */}
        {alternatives.length > 0 && (
          <Section width="wide">
            <SectionHeader
              title="Alternatives worth considering"
              subtitle="Similar products we've researched, in case this one isn't the right fit."
            />
            <div className="grid-products mt-8">
              {alternatives.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </Section>
        )}
      </main>

      <SiteFooter />

      {/* Structured data (spec §47). Uses the community rating, never the PickD
          Score — aggregateRating has a defined meaning and conflating our
          editorial score with it would misrepresent both. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
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
