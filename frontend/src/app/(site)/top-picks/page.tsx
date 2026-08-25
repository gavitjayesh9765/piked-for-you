import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { getTopPicks } from "@/lib/api";
import { formatPrice, productHref } from "@/lib/format";
import type { ProductSummary } from "@/lib/types";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductCardWide } from "@/components/product/ProductCard";
import { ScoreRing } from "@/components/product/ScoreRing";
import { Badge } from "@/components/ui/Badge";
import { PanelArriving, ValueArriving } from "@/components/ui/Arriving";
import { ItemListJsonLd } from "@/components/seo/ItemListJsonLd";

export const metadata: Metadata = {
  title: "Top Picks — the board",
  description:
    "Every product currently carrying a SortedChoice recommendation, ordered by our editors.",
  alternates: { canonical: "/top-picks" },
};

/**
 * Top Picks (spec §16).
 *
 * The homepage already renders this exact curation as a card grid, so
 * repeating the grid here would give the reader nothing for the click. The
 * page earns its place by being the *ranked* view: this is a board, and a
 * board has a number one.
 *
 * So the lead pick takes an editorial full-width slot and everything below it
 * becomes a numbered row. That hierarchy also happens to be what saves the
 * page at the current catalogue size — four products in an even grid reads as
 * an unfinished shop, while one feature plus three ranked rows reads as a
 * composed chart.
 *
 * ---------------------------------------------------------------------------
 * The board arrives in three pieces rather than one.
 *
 * The masthead's frame — breadcrumb, eyebrow, headline — is our own copy and
 * owes nothing to the API, so it renders synchronously and the destination is
 * legible the instant the click lands. The subtitle, the ledger and the board
 * itself all come from `getTopPicks()`; they sit in three different places in
 * the layout, so they need three boundaries, but they resolve from a single
 * memoized request and therefore land together.
 */
export default function TopPicksPage() {
  return (
    <main id="main">
      {/* --- Masthead ------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-line bg-bg">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

        <div className="shell relative py-12 lg:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Top Picks" }]} />

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="t-eyebrow mb-4">The board</p>
              <h1 className="t-display text-ink">Top Picks.</h1>
              <Suspense fallback={<PanelArriving lines={2} className="mt-6 max-w-xl" />}>
                <Lede />
              </Suspense>
            </div>

            <Suspense fallback={<LedgerArriving />}>
              <Ledgers />
            </Suspense>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="shell-wide pb-24 pt-14" aria-hidden="true" />}>
        <Board />
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

/* ------------------------------------------------------------------ */
/* Ranked row                                                          */
/* ------------------------------------------------------------------ */

/**
 * A chart row, not a card. The rank numeral is the largest thing in it because
 * position is the information this page adds; everything else is here to
 * justify the position.
 */
function RankedRow({ product, rank }: { product: ProductSummary; rank: number }) {
  const { title, brand, tagline, primaryImage, score, badges, pricing, category } = product;
  const leadBadge = badges.find((b) => b.style === "editorial") ?? badges[0];

  return (
    <li className="group relative border-b border-line">
      <div className="flex items-center gap-5 py-6 sm:gap-8">
        {/* Rank */}
        <span
          className="tabular w-10 shrink-0 font-display text-headline-md font-bold leading-none
                     text-ink-faint transition-colors duration-fast group-hover:text-brand sm:w-14 sm:text-headline-lg"
          aria-hidden="true"
        >
          {String(rank).padStart(2, "0")}
        </span>

        {/* Plate */}
        <div className="plate relative hidden h-20 w-20 shrink-0 overflow-hidden rounded-md sm:block">
          {primaryImage ? (
            <Image
              src={primaryImage.url}
              alt=""
              fill
              sizes="80px"
              className="object-contain p-2.5 transition-transform duration-slow ease-ease group-hover:scale-[1.06]"
            />
          ) : (
            <div className="dot-matrix h-full w-full" />
          )}
        </div>

        {/* Copy */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="t-eyebrow">{brand.name}</span>
            <span className="text-ink-faint" aria-hidden="true">
              ·
            </span>
            <Link
              href={`/c/${category.path.join("/")}`}
              className="relative z-10 font-label text-label-xs uppercase tracking-[0.08em]
                         text-ink-subtle transition-colors duration-fast hover:text-brand"
            >
              {category.name}
            </Link>
          </div>

          <h3 className="mt-1.5 text-headline-sm text-ink">
            <Link
              href={productHref(product)}
              className="transition-colors duration-fast after:absolute after:inset-0 hover:text-brand"
            >
              {title}
            </Link>
          </h3>

          <p className="mt-1.5 line-clamp-1 text-body-sm text-ink-muted">{tagline}</p>

          {/* The right-hand price column is gone below `sm`, so the price
              rejoins the copy rather than vanishing — on a ranked board it is
              half of what makes a position arguable. */}
          <p className="tabular mt-2 text-body-sm font-bold text-ink sm:hidden">
            {formatPrice(pricing.current, pricing.currency)}
          </p>
        </div>

        {/* Signals — badge and price collapse away first, the score never does */}
        <div className="hidden shrink-0 lg:block">
          {leadBadge ? <Badge badge={leadBadge} size="sm" /> : null}
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <div className="tabular text-headline-sm font-bold text-ink">
            {formatPrice(pricing.current, pricing.currency)}
          </div>
        </div>

        {score ? (
          <div className="shrink-0">
            <ScoreRing score={score.overall} size="sm" showLabel={false} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Supporting states                                                   */
/* ------------------------------------------------------------------ */

function EmptyBoard() {
  return (
    <div className="shell-content py-24 text-center">
      <p className="t-eyebrow mb-4">Nothing on the board</p>
      <h2 className="t-headline text-ink">The first verdicts are still being written.</h2>
      <p className="mx-auto mt-5 max-w-md text-body-md text-ink-muted">
        We publish a pick only once the research behind it is finished. Until then this page stays
        empty rather than filling itself with whatever happens to be in stock.
      </p>
      <Link
        href="/c"
        className="mt-8 inline-flex items-center gap-2 font-label text-label font-semibold uppercase
                   tracking-[0.08em] text-brand transition-colors duration-fast hover:text-ink"
      >
        Browse the index
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

/** The disclosure belongs next to the ranking it governs, not only in the footer. */
function MethodNote() {
  return (
    <aside className="mt-section border-t border-line pt-8">
      <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-10">
        <p className="t-eyebrow">How this is ranked</p>
        <p className="max-w-prose text-body-sm text-ink-muted">
          Position on this board is an editorial judgement, not an automatic sort — our editors
          decide what leads, which is why the number one is not always the highest number. The
          PickD Score beside each pick is the measured half: performance, value at the current
          price, and how the product has held up over time. No brand can buy a place here, and the
          verdict is written before any retailer link is attached.{" "}
          <Link
            href="/how-we-research"
            className="text-brand underline decoration-brand-line underline-offset-4
                       transition-colors duration-fast hover:decoration-brand"
          >
            How we research
          </Link>
          .
        </p>
      </div>
    </aside>
  );
}

async function Lede() {
  const section = await getTopPicks();
  return (
    <p className="mt-6 max-w-xl text-body-lg text-ink-muted">
      {section?.subtitle ?? "The highest-scoring products across every category we cover."}{" "}
      Ordered by our editors, and every verdict written before any retailer link was attached.
    </p>
  );
}

async function Ledgers() {
  const section = await getTopPicks();
  const picks = section?.products ?? [];

  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end">
      <Ledger value={String(picks.length)} label="On the board" />
      <Ledger
        value={
          picks.length
            ? (picks.reduce((s, p) => s + (p.score?.overall ?? 0), 0) / picks.length).toFixed(1)
            : "—"
        }
        label="Average score"
        accent
      />
      <Ledger value="0" label="Paid placements" />
    </dl>
  );
}

/** The ledger's own geometry, so the masthead does not resize when it lands. */
function LedgerArriving() {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end">
      {["On the board", "Average score", "Paid placements"].map((label) => (
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

async function Board() {
  const section = await getTopPicks();
  const picks = section?.products ?? [];
  const [lead, ...rest] = picks;

  return (
    <>
      {picks.length === 0 ? (
        <EmptyBoard />
      ) : (
        <div className="shell-wide pb-24 pt-14 lg:pt-20">
          {/* --- The lead ------------------------------------------- */}
          {lead ? (
            <section aria-labelledby="lead-pick">
              <div className="flex items-center gap-4 border-b border-line pb-5">
                <span
                  className="tabular font-display text-headline-lg font-bold leading-none text-brand"
                  aria-hidden="true"
                >
                  01
                </span>
                <h2 id="lead-pick" className="t-eyebrow">
                  Our editors&rsquo; number one right now
                </h2>
              </div>

              <div className="mt-8">
                <ProductCardWide product={lead} />
              </div>
            </section>
          ) : null}

          {/* --- The rest ------------------------------------------- */}
          {rest.length > 0 ? (
            <section aria-labelledby="the-rest" className="mt-section">
              <h2 id="the-rest" className="t-eyebrow border-b border-line pb-5">
                The rest of the board
              </h2>

              <ol className="mt-2">
                {rest.map((product, i) => (
                  <RankedRow key={product.id} product={product} rank={i + 2} />
                ))}
              </ol>
            </section>
          ) : null}

          <MethodNote />

          {/* The board IS a ranking, and this is the one page on the site whose
              ordering is a deliberate editorial claim rather than a sort — the
              MethodNote above says so in prose. `ItemList` says the same thing
              in the form a crawler can read.

              Note `picks`, not `rest`: the numbering here starts at the lead
              pick, which the layout renders separately as 01. Building the list
              from `rest` would silently declare the number two to be number
              one. */}
          <ItemListJsonLd products={picks} name="SortedChoice Top Picks" />
        </div>
      )}    </>
  );
}
