import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatPrice, formatPriceRange, productHref } from "@/lib/format";
import type { ProductSummary } from "@/lib/types";
import { Badge, CommunityRating, ValueChip } from "@/components/ui/Badge";
import { ScoreRing } from "./ScoreRing";
import { SaveButton } from "./SaveButton";

/**
 * The product card (spec §51).
 *
 * The load-bearing element here is the TAGLINE — the one-line reason this
 * product is worth considering. A card without it is a marketplace listing;
 * a card with it is a recommendation. See docs/01-design-brainstorm.md §3.3.
 *
 * Note what is deliberately absent: no cart, no "Add to", no basket glyph.
 * PickDForYou does not sell (spec §4.5).
 */
export function ProductCard({
  product,
  priority = false,
  className,
  isAuthed = false,
  isSaved = false,
}: {
  product: ProductSummary;
  priority?: boolean;
  className?: string;
  /** Drives whether Save prompts for login. Presentation only. */
  isAuthed?: boolean;
  isSaved?: boolean;
}) {
  const { title, brand, tagline, primaryImage, score, badges, pricing, communityRating } = product;

  // One editorial badge maximum on a card — the rest are shown on the product
  // page. Stacking badges turns curation into noise.
  const leadBadge = badges.find((b) => b.style === "editorial") ?? badges[0];
  const hasValueSignal = badges.some((b) => b.style === "value");

  return (
    <article
      className={cn(
        "panel panel-raise group relative flex flex-col overflow-hidden",
        className,
      )}
    >
      {/* --- Header: badge + score, the two curation signals --- */}
      <div className="flex items-start justify-between gap-3 p-4 pb-0">
        {/* `min-w-0` lets a long badge name truncate. Without it the badge's
            intrinsic width becomes the card's minimum, and the card's minimum
            becomes the grid's — which is how one long name used to push a
            360px-wide phone into a horizontal scroll. */}
        {leadBadge ? <Badge badge={leadBadge} size="sm" className="min-w-0" /> : <span />}
        <div className="flex shrink-0 items-start gap-2">
          {/* Sits above the card's link overlay so it stays clickable */}
          <SaveButton productId={product.id} initialSaved={isSaved} isAuthed={isAuthed} />
          {score ? <ScoreRing score={score.overall} size="sm" showLabel={false} /> : null}
        </div>
      </div>

      {/* --- Image plate --- */}
      <Link href={productHref(product)} className="relative block" tabIndex={-1} aria-hidden="true">
        <div className="plate relative mx-4 mt-3 aspect-[4/3] overflow-hidden rounded-md">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt=""
              fill
              sizes="(max-width: 640px) 90vw, (max-width: 1280px) 33vw, 20vw"
              priority={priority}
              className="object-contain p-5 transition-transform duration-slow ease-ease group-hover:scale-[1.03]"
            />
          ) : (
            <div className="dot-matrix h-full w-full" />
          )}
        </div>
      </Link>

      {/* --- Body --- */}
      <div className="flex flex-1 flex-col p-4 pt-5">
        <span className="t-eyebrow">{brand.name}</span>

        <h3 className="mt-1.5 text-headline-sm text-ink">
          <Link href={productHref(product)} className="after:absolute after:inset-0 hover:text-brand transition-colors duration-fast">
            {title}
          </Link>
        </h3>

        {/* THE VERDICT LINE — this is the product */}
        <p className="mt-2 line-clamp-2 text-body-sm text-ink-muted">{tagline}</p>

        {/* --- Footer: value signal + price --- */}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>{hasValueSignal ? <ValueChip /> : null}</div>
          <div className="text-right">
            <div className="tabular text-headline-sm font-bold text-ink">
              {formatPrice(pricing.current, pricing.currency)}
            </div>
            {pricing.min != null && pricing.max != null && (
              <div className="tabular text-label-xs text-ink-subtle">
                {formatPriceRange(pricing.min, pricing.max, pricing.currency)}
              </div>
            )}
          </div>
        </div>

        {/* Community rating sits below a hairline, visually separated from the
            PickD Score above — two different sources, never merged (spec §32) */}
        {communityRating && communityRating.count > 0 && (
          <div className="hairline mt-4 pt-3">
            <CommunityRating average={communityRating.average} count={communityRating.count} />
          </div>
        )}
      </div>
    </article>
  );
}

/**
 * Wide variant for editorial/hero placements — same data, landscape composition.
 * Used where a section wants one anchor product rather than an even grid.
 */
export function ProductCardWide({ product }: { product: ProductSummary }) {
  const { title, brand, tagline, primaryImage, score, badges, pricing } = product;
  const leadBadge = badges.find((b) => b.style === "editorial") ?? badges[0];

  return (
    <article className="panel panel-raise group relative grid grid-cols-1 overflow-hidden sm:grid-cols-2">
      <div className="plate relative aspect-[4/3] sm:aspect-auto sm:min-h-[320px]">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 40vw"
            className="object-contain p-8 transition-transform duration-slow ease-ease group-hover:scale-[1.03]"
          />
        ) : (
          /* Same fallback the compact card uses. Without it an imageless
             product renders a dead slab, which is the common case until the
             catalogue has photography. */
          <div className="dot-matrix h-full w-full" />
        )}
      </div>

      <div className="flex flex-col justify-center gap-4 p-6 lg:p-10">
        <div className="flex items-center justify-between gap-4">
          {leadBadge ? <Badge badge={leadBadge} size="sm" /> : <span />}
          {score ? <ScoreRing score={score.overall} size="md" /> : null}
        </div>

        <div>
          <span className="t-eyebrow">{brand.name}</span>
          <h3 className="mt-1.5 text-headline-md text-ink">
            <Link href={productHref(product)} className="after:absolute after:inset-0 hover:text-brand transition-colors duration-fast">
              {title}
            </Link>
          </h3>
        </div>

        <p className="max-w-prose text-body-md text-ink-muted">{tagline}</p>

        <div className="tabular text-headline-sm font-bold text-ink">
          {formatPrice(pricing.current, pricing.currency)}
        </div>
      </div>
    </article>
  );
}

/** Skeleton matching the card's exact geometry, so grids don't jump on load. */
export function ProductCardSkeleton() {
  return (
    <div className="panel flex animate-pulse flex-col overflow-hidden">
      <div className="flex items-start justify-between p-4 pb-0">
        <div className="h-6 w-28 rounded-xs bg-surface-2" />
        <div className="h-10 w-10 rounded-full bg-surface-2" />
      </div>
      <div className="mx-4 mt-3 aspect-[4/3] rounded-md bg-surface-2" />
      <div className="flex flex-col gap-2 p-4 pt-5">
        <div className="h-3 w-16 rounded-xs bg-surface-2" />
        <div className="h-5 w-3/4 rounded-xs bg-surface-2" />
        <div className="h-3 w-full rounded-xs bg-surface-2" />
        <div className="h-3 w-5/6 rounded-xs bg-surface-2" />
        <div className="mt-4 h-6 w-24 self-end rounded-xs bg-surface-2" />
      </div>
    </div>
  );
}
