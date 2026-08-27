import type { Category, ProductSummary } from "./types";

/** Default market is India (spec: sortedchoice.in, ₹ pricing examples). */
const DEFAULT_LOCALE = "en-IN";

export function formatPrice(amount: number | string | null | undefined, currency = "INR"): string {
  // Coerced at the boundary. These values originate in a NUMERIC column, and a
  // serialiser change upstream should not be able to crash a page.
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

/** Compact range for cards, e.g. "₹22,000 – ₹27,000" (spec §20). */
export function formatPriceRange(
  min: number | string,
  max: number | string,
  currency = "INR",
): string {
  if (Number(min) === Number(max)) return formatPrice(min, currency);
  return `${formatPrice(min, currency)} – ${formatPrice(max, currency)}`;
}

export function formatCompact(n: number): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(DEFAULT_LOCALE, { dateStyle: "medium" }).format(new Date(iso));
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const rtf = new Intl.RelativeTimeFormat(DEFAULT_LOCALE, { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(-Math.round(diff / ms), unit);
  }
  return "just now";
}

/* ------------------------------------------------------------------ */
/* URLs — clean, hierarchical, SEO-shaped (spec §47)                   */
/* ------------------------------------------------------------------ */

/** /p/{category-slug}/{product-slug} */
export function productHref(p: Pick<ProductSummary, "slug" | "category">): string {
  return `/p/${p.category.slug}/${p.slug}`;
}

/** /c/{ancestor}/{...}/{slug} — full path so breadcrumbs are derivable from the URL */
export function categoryHref(c: Pick<Category, "slug" | "path">): string {
  const segments = c.path?.length ? c.path : [c.slug];
  return `/c/${segments.join("/")}`;
}

export function brandHref(slug: string): string {
  return `/b/${slug}`;
}

/** Discount percentage, or null when there is nothing worth shouting about. */
export function discountPercent(
  current: number | string,
  max?: number | string | null,
): number | null {
  const c = Number(current);
  const m = Number(max);
  if (!Number.isFinite(c) || !Number.isFinite(m) || m <= c) return null;
  const pct = Math.round(((m - c) / m) * 100);
  return pct >= 3 ? pct : null;
}

/**
 * The product's full name: brand, then title, with the brand dropped when the
 * title already carries it.
 *
 * ---------------------------------------------------------------------------
 * THE BUG THIS FIXES
 *
 * Six places built this string as `${brand.name} ${title}` — the product page's
 * <title>, its `Product` schema `name`, the review widget's heading, the
 * ItemList entries on every category page, and both product cards' image alt
 * text. That is correct for a title stored as "Ear (a)" under the brand
 * "Nothing", and it is how the field is meant to be authored.
 *
 * It is not how the field is always authored. Titles stored as "Google Pixel 11
 * Pro" or "Samsung Galaxy S24 5G Snapdragon" — which is how the manufacturer
 * writes them, and therefore how anyone pasting from a spec sheet writes them —
 * came out as "Google Google Pixel 11 Pro" and "Samsung Samsung Galaxy S24 5G
 * Snapdragon".
 *
 * That was invisible until image alt text was added to the product cards and
 * the doubling appeared in the markup. It had been shipping in the page title
 * and the structured-data `name` the whole time, which is the more expensive
 * half: a doubled brand in `<title>` is what a searcher sees, and a doubled
 * brand in `Product.name` is what an answer engine reads back as the product's
 * actual name.
 *
 * ---------------------------------------------------------------------------
 * WHY A PREFIX CHECK AND NOT SOMETHING CLEVERER
 *
 * The check is deliberately narrow: does the title, case-insensitively, already
 * START with the brand name followed by a word boundary. Nothing fuzzy.
 *
 * A looser rule breaks real products. "Nothing" is a brand AND an ordinary
 * word, so a substring search would mangle any title containing it. "Apple" and
 * "Google" appear inside accessory names for other brands' products. The
 * failure mode of being too clever here is silently deleting a brand from a
 * product's name, which is worse than the doubling — a reader can see a
 * doubled word and know what happened.
 *
 * A title that mentions the brand somewhere OTHER than the front therefore
 * keeps the prefix, and is correct to: "Galaxy Buds for Samsung phones" is a
 * different string from "Samsung Galaxy Buds for Samsung phones", but only one
 * of them names the manufacturer, and this is not the layer that gets to guess.
 */
export function productFullName(brand: { name: string }, title: string): string {
  const b = brand.name.trim();
  const t = title.trim();
  if (!b) return t;

  const startsWithBrand =
    t.toLowerCase().startsWith(b.toLowerCase()) &&
    // The character after the brand must be a boundary, or "Son" would swallow
    // the front of "Sony WH-1000XM5" and leave "y WH-1000XM5".
    (t.length === b.length || /[\s\-–—:,]/.test(t.charAt(b.length)));

  return startsWithBrand ? t : `${b} ${t}`;
}
