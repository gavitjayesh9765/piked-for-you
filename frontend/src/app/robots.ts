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
/**
 * Paths no crawler should spend a request on. Shared by every rule below,
 * because the reasons are the same whichever crawler is asking: these are
 * authenticated surfaces, JSON endpoints, auth funnels and infinite query
 * spaces. See the per-entry notes for the individual arguments.
 */
const DISALLOW = [
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

  // Comparison permalinks. `/compare` itself is a real landing page and stays
  // crawlable; `?p=a/b&p=c/d` is a combinatorial space of every subset of the
  // catalogue, all of which canonicalise to the bare path. Same argument as
  // the category facets below, one exponent worse.
  "/compare?*",

  // Filtered and sorted category views. The bare category path is
  // canonical and every facet combination collapses onto it, so
  // crawling them adds nothing but multiplies the URL space by every
  // brand times every sort order. Blocked at the query string so
  // /c/electronics/audio itself stays fully crawlable.
  "/c/*?*",
];

/**
 * The answer-engine crawlers, named explicitly.
 *
 * ---------------------------------------------------------------------------
 * WHY NAME THEM WHEN `User-agent: *` ALREADY ALLOWS THEM
 *
 * It does, and if nothing else changes these rules are functionally redundant.
 * They are here for what they prevent rather than what they permit.
 *
 * A blanket `*` rule is the thing somebody tightens in a hurry — one bad
 * scraper, one traffic spike, one "let us block the AI bots for now" — and
 * every well-behaved answer engine is collateral damage in the same edit.
 * Naming them makes that an explicit decision with a name attached rather than
 * a side effect, and it puts the argument in the file where the change would
 * be made.
 *
 * The argument being: this site's whole product is a researched verdict on
 * what to buy, and the fastest-growing way people ask that question is now to
 * ask an assistant. A crawler blocked here cannot cite us — it does not fall
 * back to guessing, it falls back to citing a competitor who let it in.
 *
 * ---------------------------------------------------------------------------
 * ⚠ TWO OF THESE ARE NOT SEARCH CRAWLERS, AND THE DISTINCTION MATTERS
 *
 * The list separates deliberately:
 *
 *   Search and retrieval — OAI-SearchBot, PerplexityBot, ClaudeBot,
 *     Google-Extended, Applebot-Extended. These fetch a page in order to
 *     answer a question and attribute it. Letting them in is the entire point.
 *
 *   Training — GPTBot, CCBot. These fetch a page to add it to a model's
 *     training corpus, which is a different transaction: no citation, no
 *     referral, no link. Reasonable publishers differ on this one.
 *
 * They are allowed here on the judgement that being present in a model's
 * knowledge is itself worth having for a young brand — an assistant that has
 * never encountered SortedChoice cannot recommend it even when it is the right
 * answer. If that trade ever stops looking worthwhile, move GPTBot and CCBot
 * into their own rule with `disallow: "/"`, and leave the retrieval crawlers
 * above untouched. Those are the ones that send traffic back.
 */
const ANSWER_ENGINE_AGENTS = [
  // OpenAI: search/retrieval for ChatGPT answers, and the training crawler.
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  // Anthropic.
  "ClaudeBot",
  "Claude-User",
  // Perplexity.
  "PerplexityBot",
  "Perplexity-User",
  // Google's AI surfaces. NOTE: `Google-Extended` does not crawl anything —
  // it is a permission token Googlebot's existing fetch is checked against for
  // Gemini and AI Overviews use. Disallowing it does not reduce crawl load by
  // one request; it only removes us from AI Overviews, which is where an
  // increasing share of "best X" queries now terminate.
  "Google-Extended",
  // Apple Intelligence and Siri, same permission-token model as above.
  "Applebot-Extended",
  // Microsoft Copilot.
  "Bingbot",
  // Common Crawl, which most open models are trained from downstream.
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOW,
      },
      {
        // See ANSWER_ENGINE_AGENTS above. Same exclusions, stated explicitly so
        // that tightening the wildcard rule cannot silently take them with it.
        userAgent: ANSWER_ENGINE_AGENTS,
        allow: "/",
        disallow: DISALLOW,
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    // Bare origin, no trailing slash — `Host:` is a Yandex directive and
    // takes a hostname, not a URL path. Google ignores it entirely.
    host: SITE_URL,
  };
}
