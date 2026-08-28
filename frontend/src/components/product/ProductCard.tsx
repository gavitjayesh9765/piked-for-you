import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatPrice, formatPriceRange, productFullName, productHref } from "@/lib/format";
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
 * SortedChoice does not sell (spec §4.5).
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
      {/* --- Image plate + the two curation signals ---

          The split is at `lg`, NOT at `sm`. What decides which layout works is
          the CARD's width, and the card's width comes from `--card-min`, which
          holds the column at roughly 150-200px everywhere below 1024px — a
          640px tablet gets three ~185px columns, not two wide ones. Switching
          at `sm` put the desktop layout into a 185px column, where "Worth it"
          and a price fight over one line and the badge truncates to four
          letters. 1024px is the first width at which a card is ~300px.

          The grid puts two of these side by side on a phone, which leaves the
          card about 155px wide. A header row cannot hold a badge, a save
          control and a score ring at that width — the badge ends up truncated
          to three letters. So below `sm` the controls stop being a row and
          become overlays on the plate, which is dead space anyway (the image is
          `object-contain`, so its corners are bare plate).

          DOM order is controls-then-plate because from `sm` the controls go
          back into the flow ABOVE the image. On mobile they are out of flow, so
          the plate starts at the wrapper's top edge and `top-2` lands on it. */}
      <div className="relative">
        {/* `pointer-events-none` on the strip, restored on the controls group:
            once this is a z-10 overlay it would otherwise sit above the card's
            `after:inset-0` link and turn the badge corner into a dead zone —
            the one part of a card a thumb reaches first. */}
        <div
          className="pointer-events-none absolute inset-x-2 top-2 z-10 flex items-start justify-between gap-2
                     lg:static lg:inset-auto lg:p-4 lg:pb-0"
        >
          {/* `min-w-0` lets a long badge name truncate. Without it the badge's
              intrinsic width becomes the card's minimum, and the card's minimum
              becomes the grid's — which is how one long name used to push a
              360px-wide phone into a horizontal scroll. */}
          {leadBadge ? <Badge badge={leadBadge} size="sm" className="min-w-0" /> : <span />}
          <div className="pointer-events-auto flex shrink-0 items-start gap-2">
            {/* Sits above the card's link overlay so it stays clickable */}
            <SaveButton productId={product.id} initialSaved={isSaved} isAuthed={isAuthed} />
            {/* The desktop position. Its mobile twin is on the plate below —
                ScoreRing holds no state, so rendering it twice is free. */}
            {score ? (
              <ScoreRing score={score.overall} size="sm" showLabel={false} className="hidden lg:flex" />
            ) : null}
          </div>
        </div>

        <Link href={productHref(product)} className="relative block" tabIndex={-1} aria-hidden="true">
          {/* Full-bleed on a phone: at 155px the 16px inset was costing a tenth
              of the image's width to reproduce a margin nobody reads. */}
          <div className="plate relative aspect-[4/3] overflow-hidden lg:mx-4 lg:mt-3 lg:rounded-md">
            {primaryImage ? (
              <Image
                src={primaryImage.url}
                /* Named, and safe to name — see the note on the wrapper above.

                   This was `alt=""` to stop a screen reader announcing the
                   product name twice: once from the image, once from the title
                   link below it. But the link this image sits inside is
                   `aria-hidden`, so the whole subtree is already out of the
                   accessibility tree and the alt is never read aloud at all.
                   The empty string was duplicating what ARIA had already done.

                   What it was NOT duplicating is image indexing. Google Images
                   reads `alt` and ignores `aria-hidden` entirely, so every
                   product photograph on every grid — the homepage rails, the
                   category pages, Top Picks — was being crawled with no
                   caption. Product photography is the one asset class where
                   image search sends real commercial traffic, and it was
                   opted out by accident.

                   The editor's own alt wins where one was written; the
                   brand-plus-title fallback is what the wide card already
                   uses, so the same photograph is described the same way in
                   both placements. */
                alt={primaryImage.alt ?? productFullName(brand, title)}
                fill
                sizes="(max-width: 640px) 45vw, (max-width: 1280px) 33vw, 20vw"
                priority={priority}
                className="object-contain p-4 transition-transform duration-slow ease-ease group-hover:scale-[1.03] lg:p-5"
              />
            ) : (
              <div className="dot-matrix h-full w-full" />
            )}
          </div>
        </Link>

        {score ? (
          <ScoreRing
            score={score.overall}
            size="xs"
            showLabel={false}
            className="pointer-events-none absolute bottom-2 right-2 z-10 lg:hidden"
          />
        ) : null}
      </div>

      {/* --- Body --- */}
      <div className="flex flex-1 flex-col p-3 pt-3 lg:p-4 lg:pt-5">
        <span className="t-eyebrow">{brand.name}</span>

        {/* 20px type wraps a two-word product name onto three lines in a 130px
            column, so the card steps down a size below `sm`. */}
        <h3 className="mt-1 text-[0.9375rem] font-semibold leading-snug tracking-[-0.01em] text-ink lg:mt-1.5 lg:text-headline-sm">
          <Link href={productHref(product)} className="after:absolute after:inset-0 hover:text-brand transition-colors duration-fast">
            {title}
          </Link>
        </h3>

        {/* THE VERDICT LINE — this is the product */}
        <p className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-snug text-ink-muted lg:mt-2 lg:text-body-sm lg:leading-normal">
          {tagline}
        </p>

        {/* --- Footer: value signal + price ---
            Stacked on a phone: "Worth it" and a price are together about 150px
            of unshrinkable content, and the column is 130px. */}
        <div className="mt-auto flex flex-col items-start gap-2 pt-3 lg:flex-row lg:items-end lg:justify-between lg:gap-3 lg:pt-5">
          <div>{hasValueSignal ? <ValueChip /> : null}</div>
          <div className="text-left lg:text-right">
            <div className="tabular text-[1.0625rem] font-bold text-ink lg:text-headline-sm">
              {formatPrice(pricing.current, pricing.currency)}
            </div>
            {/* Stays at 10px at every width. Two formatted prices and a dash
                run to ~140px at 11px — over budget both in a 134px phone
                column and, for the longest numbers, in a 263px desktop one. */}
            {pricing.min != null && pricing.max != null && (
              <div className="tabular text-[0.625rem] text-ink-subtle">
                {formatPriceRange(pricing.min, pricing.max, pricing.currency)}
              </div>
            )}
          </div>
        </div>

        {/* Community rating sits below a hairline, visually separated from the
            SortedChoice Score above — two different sources, never merged (spec §32) */}
        {communityRating && communityRating.count > 0 && (
          <div className="hairline mt-3 pt-3 lg:mt-4">
            <CommunityRating average={communityRating.average} count={communityRating.count} compact />
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
            /* Named, unlike the compact card's image.

               In <ProductCard> the image sits inside a link that is explicitly
               `aria-hidden`, with the product name carried by the adjacent
               title link — so an empty alt is correct there: announcing the
               name twice is worse than not announcing it here.

               This card has no such wrapper. Its image is the lead element of a
               feature slot on the homepage and at the top of Top Picks, and an
               empty alt makes the largest image on those pages invisible to
               both a screen reader and Google Images. The editor's own alt text
               wins where one was written. */
            alt={primaryImage.alt ?? productFullName(brand, title)}
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

/** Skeleton matching the card's exact geometry, so grids don't jump on load.
    It tracks the same `sm` split as the card: full-bleed plate with no header
    row on a phone, inset plate under a header row from `sm` up. */
export function ProductCardSkeleton() {
  return (
    <div className="panel flex animate-pulse flex-col overflow-hidden">
      <div className="hidden items-start justify-between p-4 pb-0 lg:flex">
        <div className="h-6 w-28 rounded-xs bg-surface-2" />
        <div className="h-10 w-10 rounded-full bg-surface-2" />
      </div>
      <div className="aspect-[4/3] bg-surface-2 lg:mx-4 lg:mt-3 lg:rounded-md" />
      <div className="flex flex-col gap-2 p-3 pt-3 lg:p-4 lg:pt-5">
        <div className="h-3 w-16 rounded-xs bg-surface-2" />
        <div className="h-5 w-3/4 rounded-xs bg-surface-2" />
        <div className="h-3 w-full rounded-xs bg-surface-2" />
        <div className="h-3 w-5/6 rounded-xs bg-surface-2" />
        <div className="mt-3 h-6 w-24 rounded-xs bg-surface-2 lg:mt-4 lg:self-end" />
      </div>
    </div>
  );
}
