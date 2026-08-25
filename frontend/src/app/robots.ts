import type { MetadataRoute } from "next";

import { SITE_URL, absoluteUrl } from "@/lib/site";

/**
 * robots.txt (spec §47).
 *
 * ---------------------------------------------------------------------------
 * WHAT ROBOTS.TXT IS, AND IS NOT
 *
 * It is a crawl budget instrument. It asks well-behaved crawlers not to spend
 * requests on pages that will never rank, so the requests they do spend land on
 * the product and category pages that will.
 *
 * It is NOT a security control, and nothing here should be read as one. A
 * `Disallow: /admin` is a public statement that /admin exists, obeyed only by
 * crawlers that choose to. The actual admin boundary is three layers deeper —
 * a JWT role check in FastAPI and Row Level Security at the database, with
 * src/proxy.ts as a UX redirect that explicitly disclaims being a boundary.
 *
 * Consequently the disallow list below is chosen for crawl economics, not
 * secrecy: every path on it is either already `noindex` in its own metadata or
 * already authenticated. Listing them here just stops the crawl happening in
 * the first place.
 *
 * ---------------------------------------------------------------------------
 * WHY NOINDEX PAGES ARE STILL LISTED
 *
 * `Disallow` and `noindex` do different jobs and one does not imply the other.
 * A disallowed page is never fetched, so its `noindex` is never read — which is
 * why a URL blocked here can still surface in results as a bare link if enough
 * pages point at it. The two are therefore used together deliberately:
 *
 *   - Account and admin routes: disallowed here AND noindex in metadata. They
 *     are linked only from authenticated chrome, so the noindex is a backstop
 *     for the case where the crawler somehow arrives anyway.
 *   - /search: disallowed because an infinite query space is the classic crawl
 *     trap, and every result page duplicates content that already ranks under
 *     its own URL.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // Authenticated surfaces. Nothing here renders without a session, so
          // a crawler gets a login redirect and learns nothing.
          "/admin",
          "/account",

          // Route handlers. JSON, never a landing page.
          "/api/",

          // The OAuth callback. Fetching it with no code is meaningless, and
          // it is the kind of URL that ends up in a referrer header and then
          // in a crawl frontier.
          "/auth/",

          // Auth funnels. Indexing them competes with the pages that should
          // rank for the brand name.
          "/login",
          "/register",
          "/forgot-password",
          "/newsletter/confirm",

          // Infinite query space — see the header note.
          "/search",

          // Internal design reference, not content.
          "/styleguide",

          // Filtered and sorted category views. The bare category path is
          // canonical and every facet combination collapses onto it, so
          // crawling them adds nothing but multiplies the URL space by every
          // brand times every sort order. Blocked at the query string so
          // /c/electronics/audio itself stays fully crawlable.
          "/c/*?*",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    // Bare origin, no trailing slash — `Host:` is a Yandex directive and
    // takes a hostname, not a URL path. Google ignores it entirely.
    host: SITE_URL,
  };
}
