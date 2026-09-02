import { headers } from "next/headers";
import { Suspense } from "react";

import { GA_ENABLED, GA_MEASUREMENT_ID, ANALYTICS_CONSENT_KEY } from "@/lib/analytics";
import { GaRouteViews } from "@/components/analytics/GaRouteViews";

/**
 * Google Analytics 4, mounted once on the public site shell.
 *
 * ---------------------------------------------------------------------------
 * THIS IS NOT THE SITE'S ANALYTICS. IT IS A SECOND, SEPARATE ONE.
 *
 * `components/analytics/PageView.tsx` and `lib/track.ts` are the FIRST-PARTY
 * counters: anonymous, cookieless, posted to our own API, and the only source
 * the admin Analytics screen reads. They are untouched by this file, they run
 * for every reader whether or not they consent to GA, and nothing here feeds
 * them or is fed by them. Two independent measurement paths, deliberately.
 *
 * Which means: the numbers will not agree, and they are not supposed to. GA is
 * blocked by extensions that leave a same-origin beacon alone, GA drops what
 * it classifies as a bot on different rules than our API does, and — see below
 * — most readers will be measured by GA without cookies at all. Treat the
 * first-party counters as the house numbers and GA as the richer, lossier
 * second opinion.
 *
 * ---------------------------------------------------------------------------
 * CONSENT: DENIED BY DEFAULT, AND WHAT THAT ACTUALLY MEANS
 *
 * `/cookies` promises analytics cookies are "set only if you agree", and
 * `/account/settings` has offered a toggle for that since before GA existed.
 * That toggle defaults OFF and there is no consent banner on this site.
 *
 * So the tag boots with Consent Mode v2 and `analytics_storage: denied`. In
 * that state gtag sets NO cookies — no `_ga`, no `_ga_*`, no client id — and
 * sends cookieless pings that GA turns into modelled traffic estimates. The
 * reader is counted; the reader is not identified, and nothing persists in
 * their browser. Flipping the settings toggle sends a `consent: update` and
 * from that point GA behaves normally, cookie and all.
 *
 * The three advertising signals are denied at boot and never granted. There is
 * no code path anywhere in this repo that grants them.
 *
 * ---------------------------------------------------------------------------
 * WHY ONE INLINE SCRIPT THAT INJECTS THE TAG, RATHER THAN THE TWO TAGS GOOGLE
 * GIVES YOU
 *
 * Google's copy-paste snippet is `<script async src=...>` followed by an inline
 * `<script>`. Both of those break here, for two separate reasons:
 *
 *   1. THE CSP. `lib/security-headers.ts` serves a strict nonce-based policy
 *      with no `'unsafe-inline'` in production. A bare inline script does not
 *      execute — it is silently dropped, which is exactly the failure mode
 *      where the tag "is installed" and reports nothing forever.
 *
 *   2. THE ORDER. Consent Mode is only honoured if the `consent` defaults run
 *      BEFORE gtag.js does. React 19 hoists `<script async src>` to <head> on
 *      its own schedule, so two sibling script tags in a layout are not
 *      guaranteed to execute in the order they are written. Losing that race
 *      does not fail loudly either: it sets a cookie for a reader who declined.
 *
 * One nonce-carrying inline script that declares consent, configures the tag
 * and only then appends gtag.js settles both. The append is trusted because
 * `'strict-dynamic'` propagates trust from a nonce-verified script to the
 * scripts it creates — which is also why the googletagmanager host in
 * `script-src` is only there for browsers too old to implement strict-dynamic.
 *
 * ---------------------------------------------------------------------------
 * WHY CONSENT IS READ SYNCHRONOUSLY, IN THE INLINE SCRIPT
 *
 * A returning reader who has already opted in must boot straight into
 * `granted`. Reading their answer from a React effect instead would leave
 * every first page view of every visit measured as denied and then upgraded a
 * moment later, which loses the session's first hit for the readers who
 * actually said yes. `localStorage` is synchronous, so this costs nothing.
 */
export async function GoogleAnalytics() {
  if (!GA_ENABLED) return null;

  // Same source as the theme script above it in the root layout: the nonce
  // minted per request by `proxy.ts`. Without it this script does not run in
  // production, and only in production — which is the worst possible way to
  // find out, so if it is ever missing the tag is not injected at all.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  if (!nonce) return null;

  return (
    <>
      <script nonce={nonce} dangerouslySetInnerHTML={{ __html: bootstrap() }} />
      {/*
        `useSearchParams` inside forces this subtree dynamic, and an unwrapped
        one fails the build for any statically rendered route. The boundary
        never shows anything — the component renders null — it exists purely to
        keep the rest of the page prerenderable.
      */}
      <Suspense fallback={null}>
        <GaRouteViews />
      </Suspense>
    </>
  );
}

/**
 * The bootstrap, as source text.
 *
 * Kept as a plain string rather than a stringified function so that what runs
 * in the browser is exactly what is written here — no bundler transform, no
 * minifier renaming `gtag`, which gtag.js looks up by name on `window`.
 *
 * ⚠ `send_page_view: false` is load-bearing. gtag.js would otherwise count one
 * page view on load and then nothing ever again, because App Router
 * navigations never reload the document — every route after the landing page
 * would be invisible. `GaRouteViews` sends them all instead, including the
 * first, so there is exactly one page_view per route and no double count.
 */
function bootstrap(): string {
  // JSON.stringify, not quotes: these are our own constants today, but this is
  // string-concatenated into executable script, and the day one of them comes
  // from anywhere else is the day quoting by hand becomes an injection.
  const id = JSON.stringify(GA_MEASUREMENT_ID);
  const key = JSON.stringify(ANALYTICS_CONSENT_KEY);

  return `(function(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){ window.dataLayer.push(arguments); }
  window.gtag = gtag;

  var granted = false;
  try { granted = window.localStorage.getItem(${key}) === "1"; } catch (e) {}

  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: granted ? "granted" : "denied"
  });

  gtag("js", new Date());
  gtag("config", ${id}, {
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false
  });

  var s = document.createElement("script");
  s.async = true;
  s.src = "https://www.googletagmanager.com/gtag/js?id=" + ${id};
  document.head.appendChild(s);
})();`;
}
