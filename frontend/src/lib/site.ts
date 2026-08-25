/**
 * Site-level identity constants.
 *
 * These exist in one place because four unrelated subsystems have to agree on
 * them and silently produce wrong output when they don't:
 *
 *   - `metadataBase` in app/layout.tsx, which resolves every relative canonical
 *   - app/sitemap.ts, where a wrong origin submits URLs that 404 to Google
 *   - app/robots.ts, whose `sitemap:` line must point at the same origin
 *   - the Organization / WebSite JSON-LD on the homepage
 *
 * A canonical pointing at localhost is not a visible bug. Nothing errors, the
 * page renders, and the site simply stops ranking — which is why this is a
 * constant rather than four separate `process.env` reads.
 */

/**
 * Public origin, no trailing slash.
 *
 * The fallback is the production domain rather than localhost on purpose. If
 * NEXT_PUBLIC_SITE_URL goes missing on a deploy the failure mode should be
 * "canonicals are right anyway", not "the whole site declares itself to live on
 * a loopback address". Local development sets the variable explicitly.
 *
 * ---------------------------------------------------------------------------
 * WHY `www`, WHICH LOOKS WRONG NEXT TO EVERY OTHER FILE IN THIS REPO
 *
 * Vercel serves `www.sortedchoice.com` as the Production domain. The apex
 * `sortedchoice.com` is configured as a 308 to it, as is
 * `piked-for-you.vercel.app` (307).
 *
 * So the apex is not the site — it is a redirect to the site, and a canonical
 * pointing at it tells a crawler "the original of this page lives at a URL that
 * will immediately send you somewhere else". Google resolves that, but it is a
 * self-inflicted indirection on every indexable URL, and the sitemap would ship
 * fifty-odd of them at once.
 *
 * Note that the backend and the Supabase email templates hardcode the apex
 * (`backend/app/core/config.py`, `supabase/templates/build.mjs`). Those are
 * transactional links, where one redirect hop is harmless and query strings
 * survive it intact. This constant governs what we declare to crawlers, which
 * is a different job with a different correct answer — they are allowed to
 * disagree, and this comment exists so the disagreement does not look like a
 * typo to whoever reads it next.
 *
 * If the primary is ever flipped to the apex in Vercel, change this too.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sortedchoice.com"
).replace(/\/+$/, "");

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const SITE_NAME = "SortedChoice";

export const SITE_TAGLINE =
  "We research products so you can choose with confidence";

export const SITE_DESCRIPTION =
  "Independent product research, comparisons and verdicts. Stop spending hours researching — see what's actually worth buying, and why.";
