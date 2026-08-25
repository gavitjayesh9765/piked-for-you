import Link from "next/link";

import { cn } from "@/lib/cn";
import { discountPercent, formatPrice, formatPriceRange } from "@/lib/format";
import type { Pricing, RetailerLink } from "@/lib/types";

import { RetailButton } from "@/components/ui/Button";

/**
 * Price and where to buy (spec §20, §26, §59).
 *
 * Deliberately the last thing on the page before the alternatives, and
 * deliberately not dressed up. The verdict has already been made and argued by
 * the time a reader arrives here; this block's only job is to be honest about
 * three things:
 *
 *   1. What it costs, and whether that is a good moment to pay it.
 *   2. Who is selling it.
 *   3. Which of those links pays us.
 *
 * (3) is labelled per link rather than only in the footer. A blanket footer
 * disclosure technically satisfies §59 but leaves a reader to guess which
 * button is the compromised one, and the answer here — "the official store
 * link pays us nothing, the marketplace ones do" — is exactly the kind of
 * thing that makes the disclosure worth reading.
 *
 * Availability is shown where the retailer told us, and left silent where it
 * did not. `inStock` is three-valued for that reason: rendering "in stock" off
 * a null would be inventing a fact about someone else's shop.
 */
export function BuyingOptions({
  pricing,
  retailers,
  id = "buying-options",
  className,
}: {
  pricing: Pricing;
  /** Active links only — the caller filters, so a draft-only link cannot
   *  reach a public render by accident. */
  retailers: RetailerLink[];
  id?: string;
  className?: string;
}) {
  const off = discountPercent(pricing.current, pricing.max);
  const hasAffiliate = retailers.some((r) => r.isAffiliate);

  return (
    <section id={id} aria-labelledby="buying-heading" className={cn("panel p-6 sm:p-8", className)}>
      <h2 id="buying-heading" className="t-eyebrow text-brand">
        Price and where to buy
      </h2>

      {/* --- The price, restated. A reader who scrolled this far has passed
              the hero and should not have to scroll back up to it. --- */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="tabular text-display-lg font-bold leading-none text-ink">
          {formatPrice(pricing.current, pricing.currency)}
        </span>
        {pricing.min != null && pricing.max != null && (
          <span className="tabular text-body-sm text-ink-subtle">
            Range {formatPriceRange(pricing.min, pricing.max, pricing.currency)}
          </span>
        )}
        {off && (
          <span
            className="rounded-xs border border-value-line bg-value-soft px-2.5 py-1 font-label
                       text-label-xs font-bold uppercase tracking-[0.1em] text-value-on-soft"
          >
            {off}% below peak
          </span>
        )}
      </div>

      {retailers.length === 0 ? (
        <p className="mt-5 text-body-sm text-ink-muted">
          We have not found a retailer link we are willing to publish for this one yet.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {retailers.map((r, i) => (
            <li key={r.id}>
              <RetailButton
                retailer={r.retailer}
                href={r.url}
                price={
                  r.displayPrice ? formatPrice(r.displayPrice, pricing.currency) : undefined
                }
                emphasis={i === 0 ? "primary" : "secondary"}
              />
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-1">
                <span
                  className={cn(
                    "font-label text-label-xs uppercase tracking-[0.12em]",
                    r.isAffiliate ? "text-ink-subtle" : "text-value",
                  )}
                >
                  {r.isAffiliate ? "Affiliate link" : "No affiliate link"}
                </span>
                {r.inStock === false && (
                  <span className="text-label-xs text-danger">
                    Listed as out of stock when we last looked
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 space-y-2 border-t border-line pt-5">
        <p className="text-label-xs leading-relaxed text-ink-faint">
          SortedChoice does not sell this product. Prices are indicative and last checked
          separately by each retailer — confirm on their site before buying.
        </p>
        {hasAffiliate && (
          <p className="text-label-xs leading-relaxed text-ink-faint">
            Links marked <span className="text-ink-subtle">Affiliate link</span> earn us a
            commission if you buy. It costs you nothing, it does not change what any retailer
            charges, and it has no bearing on the verdict above — which is written before any
            link is attached.{" "}
            <Link href="/affiliate-disclosure" className="text-brand hover:underline">
              How we make money
            </Link>
            .
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * The price at every retailer, at a glance — for the hero, above the fold.
 *
 * Not three more buttons. The hero already carries one orange exit, and the
 * colour grammar only works while orange means "this is THE way out"; three of
 * them side by side is three competing calls to action and no recommendation.
 * So this is a *table*, and the rows are deliberately not links — the labelled,
 * disclosed buttons live in <BuyingOptions> below, which is where §59 wants a
 * clickable affiliate link to be.
 *
 * What it adds that the price alone cannot: whether the price you are looking
 * at is the best one. Sorted cheapest first and stamped with the gap, so
 * "Flipkart is ₹2,099 more" is readable without arithmetic.
 *
 * Sorting by price rather than by the retailer's configured order means the
 * lead button and the top row can disagree — the CTA follows `display_order`,
 * this follows the money. That disagreement is the honest outcome and worth
 * showing: if the retailer we list first is not the cheapest, a reader should
 * be able to see that on the same screen.
 *
 * Renders nothing below two priced retailers. A one-row comparison is not a
 * comparison, and an empty-ish panel in the hero is worse than the whitespace
 * it was added to fill.
 */
export function PriceComparison({
  pricing,
  retailers,
  className,
}: {
  pricing: Pricing;
  retailers: RetailerLink[];
  className?: string;
}) {
  const priced = retailers
    .filter((r) => r.displayPrice != null && Number.isFinite(Number(r.displayPrice)))
    .map((r) => ({ ...r, amount: Number(r.displayPrice) }))
    .sort((a, b) => a.amount - b.amount);

  if (priced.length < 2) return null;

  const lowest = priced[0].amount;

  return (
    <section aria-labelledby="price-compare-heading" className={cn("panel p-5 sm:p-6", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 id="price-compare-heading" className="t-eyebrow">
          Price across retailers
        </h2>
        <Link
          href="#buying-options"
          className="font-label text-label-xs uppercase tracking-[0.12em] text-ink-subtle
                     transition-colors duration-fast hover:text-brand"
        >
          All {retailers.length} buying options ↓
        </Link>
      </div>

      <dl className="mt-4 divide-y divide-line-faint">
        {priced.map((r) => {
          const delta = r.amount - lowest;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
            >
              <dt className="flex items-center gap-2.5 text-body-sm text-ink">
                {r.retailer}
                {r.inStock === false && (
                  <span className="font-label text-label-xs uppercase tracking-[0.1em] text-danger">
                    Out of stock
                  </span>
                )}
              </dt>
              <dd className="flex items-baseline gap-3">
                {delta === 0 ? (
                  <span
                    className="rounded-xs border border-value-line bg-value-soft px-2 py-0.5
                               font-label text-label-xs font-bold uppercase tracking-[0.1em]
                               text-value-on-soft"
                  >
                    Lowest
                  </span>
                ) : (
                  <span className="tabular text-body-sm text-ink-subtle">
                    +{formatPrice(delta, pricing.currency)}
                  </span>
                )}
                <span className="tabular text-body-md font-semibold text-ink">
                  {formatPrice(r.amount, pricing.currency)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
