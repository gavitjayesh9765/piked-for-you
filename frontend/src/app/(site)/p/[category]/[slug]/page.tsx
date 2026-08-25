import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getAlternatives, getProduct, getReviews } from "@/lib/api";
import type { AlternativePick, Product } from "@/lib/types";
import { getAuthedUser } from "@/lib/supabase/server";
import { discountPercent, formatPrice, formatPriceRange } from "@/lib/format";

import { Section, SectionHeader } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { jsonLd } from "@/lib/json-ld";
import { Badge, CommunityRating } from "@/components/ui/Badge";
import { RetailButton } from "@/components/ui/Button";
import { Gallery } from "@/components/product/Gallery";
import { ScorePanel, ScoreRing } from "@/components/product/ScoreRing";
import { AudienceFit, ProsCons, SpecsDisclosure, VerdictBlock } from "@/components/product/Verdict";
import {
  QuickSummary,
  ReasonChip,
  ResearchNote,
  TrustLinks,
  VerdictBanner,
} from "@/components/product/Decision";
import { BuyingOptions, PriceComparison } from "@/components/product/BuyingOptions";
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
  // The recommendation summary is the better description when there is one: it
  // is the sentence a searcher is actually looking for, and it is written to
  // stand alone, which a tagline is not always.
  const description =
    product.seo?.metaDescription ?? product.verdictSummary ?? product.tagline;

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

/**
 * The product page.
 *
 * The order of this page IS the product. A reader arrives with one question —
 * *should I buy this?* — and every block below is placed by how directly it
 * answers it:
 *
 *   1. What it is          — gallery, title, price, score at a glance
 *   2. The answer          — BUY NOW / WAIT / SKIP / CONSIDER AN ALTERNATIVE
 *   3. The answer, fast    — fifteen-second summary
 *   4. The argument        — verdict prose, then pros and cons
 *   5. Whether it is you   — best for / not ideal for
 *   6. The scoring         — overall and per criterion
 *   7. The detail          — specifications, collapsed
 *   8. Where to buy        — every link, every affiliate relationship named
 *   9. Who is telling you  — how we reviewed this, and the four policy docs
 *  10. What else           — community reviews, then better alternatives
 *
 * What moved, and why:
 *
 *  - Specifications were in a sidebar rail beside the verdict, competing with
 *    it for the same screen. They are reference material for a decision that
 *    has already been made by the time you want them, so they are now below
 *    the argument and collapsed.
 *  - The score breakdown was in the hero column, where five criteria rendered
 *    as five near-full-width bars and read as a loading state. It now has the
 *    page's width and two columns.
 *  - The retailer stack has moved out of the hero, with one primary exit left
 *    behind. A reader who already knows they want it can still leave in one
 *    click; a reader who came for advice is no longer sold to before being
 *    advised.
 */
export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { category, slug } = await params;

  const product = await getProduct(category, slug);
  // A draft or archived product must be unreachable publicly (spec §38, §61).
  // The API enforces this too; this is defence in depth, not the control.
  if (!product || product.status !== "published") notFound();

  const off = discountPercent(product.pricing.current, product.pricing.max);
  const activeRetailers = product.retailers.filter((r) => r.isActive);
  const lead = activeRetailers[0];

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

        {/* ============ 1–2. What it is, and the answer ==================
            Full-bleed two-column. The gallery gets the larger share on wide
            displays; the decision column is capped so it never sprawls.

            The gallery pins itself: its own root carries `lg:self-start`,
            `lg:sticky` and the nav-clearing offset (components/product/Gallery.tsx).
            It must therefore stay the direct grid item — wrapping it in a
            positioning div makes the wrapper the item, `self-start` stops
            applying, and the wrapper's default `min-width:auto` lets the
            column blow past the viewport on a phone. */}
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

            {/* --- THE ANSWER. Directly under the price, because the price is
                    the question a reader is holding when they read it. --- */}
            <VerdictBanner
              stance={product.verdictStance}
              summary={product.verdictSummary}
              className="mt-7 sm:mt-8"
            />

            {/* --- One exit, not a stack (spec §26). The full set of buying
                    options lives below the verdict, which is where the page
                    argues you should decide from. This is here for the reader
                    who arrived already decided. --- */}
            {lead && (
              <div className="mt-6 flex flex-col gap-4">
                <RetailButton
                  retailer={lead.retailer}
                  href={lead.url}
                  price={
                    lead.displayPrice
                      ? formatPrice(lead.displayPrice, product.pricing.currency)
                      : undefined
                  }
                  emphasis="primary"
                />

                {/* Whether the price above is the best one — the question a
                    reader is holding the moment they read it. A table, not more
                    buttons: the hero keeps one orange exit, and this carries the
                    comparison the exit cannot. Absent below two priced
                    retailers, in which case the jump link stands alone. */}
                <PriceComparison pricing={product.pricing} retailers={activeRetailers} />

                {activeRetailers.length > 1 &&
                  activeRetailers.filter((r) => r.displayPrice != null).length < 2 && (
                    <Link
                      href="#buying-options"
                      className="font-label text-label-xs uppercase tracking-[0.12em] text-ink-subtle
                                 transition-colors duration-fast hover:text-brand"
                    >
                      All {activeRetailers.length} buying options ↓
                    </Link>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* ============ 3. Fifteen seconds ============ */}
        <div className="shell-wide mt-section">
          <div className="mx-auto max-w-[1240px]">
            <QuickSummary
              pros={product.pros}
              cons={product.cons}
              bestFor={product.bestFor}
              notIdealFor={product.notIdealFor}
            />
          </div>
        </div>

        {/* ============ 4–7. The argument, then the reference =============
            One region, not five. Each of these blocks used to be its own
            <Section>, so a full section gap sat between a verdict and the pros
            that argue it — the page read as unrelated islands with dead air
            between them.

            Capped narrower than the hero on purpose: the hero is a grid and
            wants the width, this is argument and does not
            (docs/01-design-brainstorm.md §3.2). */}
        <div className="shell-wide mt-6">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-5">
            {product.verdict && <VerdictBlock verdict={product.verdict} />}

            <ProsCons pros={product.pros} cons={product.cons} className="grid gap-5 md:grid-cols-2" />

            <AudienceFit
              bestFor={product.bestFor}
              notIdealFor={product.notIdealFor}
              className="grid gap-5 md:grid-cols-2"
            />

            {product.score && (
              <ScorePanel
                overall={product.score.overall}
                criteria={product.score.criteria}
                updatedAt={product.score.updatedAt}
              />
            )}

            <SpecsDisclosure groups={product.specifications} />

            {/* ============ 8. Where to buy ============ */}
            <BuyingOptions pricing={product.pricing} retailers={activeRetailers} />

            {/* ============ 9. Who is telling you ============ */}
            <ResearchNote
              handsOnTested={product.handsOnTested}
              note={product.researchNote}
              researchedAt={product.researchedAt ?? product.score?.updatedAt}
            />
            <TrustLinks className="px-1" />
          </div>
        </div>

        {/* ============ 10. Community =================

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

        {/* ============ 10. Better alternatives (spec §52) ============ */}
        <Suspense fallback={null}>
          <Alternatives productId={product.id} stance={product.verdictStance} />
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
            // Our verdict, declared as what it is: an editorial review with its
            // own 0–10 scale, kept structurally separate from the community
            // aggregate above (spec §32).
            ...(product.score && product.verdictSummary
              ? {
                  review: {
                    "@type": "Review",
                    reviewRating: {
                      "@type": "Rating",
                      ratingValue: product.score.overall,
                      bestRating: 10,
                      worstRating: 0,
                    },
                    author: { "@type": "Organization", name: "SortedChoice" },
                    reviewBody: product.verdictSummary,
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

/**
 * Better alternatives (spec §52).
 *
 * The heading follows the verdict. A reader who has just been told to SKIP is
 * not browsing "similar products" — they are asking what to buy instead, and
 * the block should say so rather than making them infer it.
 *
 * Curated picks carry an editor's reason; anything the price-band heuristic
 * supplied is labelled as a neighbour and nothing more. The two are visually
 * distinct on purpose: presenting arithmetic as a recommendation is the exact
 * failure this site exists to avoid.
 */
async function Alternatives({
  productId,
  stance,
}: {
  productId: string;
  stance?: Product["verdictStance"];
}) {
  const alternatives = await getAlternatives(productId, 5);
  if (alternatives.length === 0) return null;

  const redirecting = stance === "skip" || stance === "consider_alternative";

  return (
    <Section width="wide">
      <SectionHeader
        title={redirecting ? "Buy one of these instead" : "Better alternatives"}
        subtitle={
          redirecting
            ? "Where the money is better spent, and who each of these is for."
            : "Products that beat this one on a specific priority — value, performance, or budget."
        }
      />
      <div className="grid-products stagger mt-8">
        {alternatives.map((alt: AlternativePick) => (
          <div key={alt.id} className="flex flex-col gap-3">
            {/* Fixed-height header so every card in the row starts at the same
                line. Without it a two-line note under one chip pushes its card
                down and the row reads as broken rather than as annotated. The
                clamp is what makes the min-height a guarantee instead of a
                hope. */}
            <div className="flex min-h-[4.5rem] flex-col gap-2">
              <ReasonChip reason={alt.reason} curated={alt.isCurated} className="self-start" />
              {alt.note && (
                <span className="line-clamp-2 text-body-sm leading-snug text-ink-muted">
                  {alt.note}
                </span>
              )}
            </div>
            <ProductCard product={alt} className="flex-1" />
          </div>
        ))}
      </div>
    </Section>
  );
}
