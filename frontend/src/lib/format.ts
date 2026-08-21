import type { Category, ProductSummary } from "./types";

/** Default market is India (spec: pickdforyou.in, ₹ pricing examples). */
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
