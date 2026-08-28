import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Hanken_Grotesk, Inter, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BackToTop } from "@/components/layout/BackToTop";
import { themeInitScript } from "@/components/layout/ThemeToggle";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

/**
 * Three type tiers, each with a job (docs/01-design-brainstorm.md §5):
 *   Hanken Grotesk — display/headline, confident and tightly tracked
 *   Inter          — body, the readability workhorse
 *   Geist          — labels, uppercase and tracked
 *   Geist Mono     — data: scores, prices, specs. Tabular figures.
 *
 * Loaded through next/font so they self-host and don't block first paint.
 */
const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-hanken",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    // No `images` here on purpose. app/opengraph-image.tsx is picked up
    // automatically and inherited by every route that does not declare its own,
    // and listing an image in both places is how you end up with two og:image
    // tags and a scraper picking whichever it saw first.
  },
  /**
   * Twitter reads Open Graph tags as a fallback, so the title, description and
   * image above already carry over. What does NOT carry over is the card SIZE:
   * absent an explicit `card`, a link unfurls as a `summary` — a thumbnail the
   * size of a favicon beside two lines of text. `summary_large_image` is what
   * turns the 1200×630 card we now generate into the full-width image the card
   * was designed to be.
   *
   * This also applies well beyond Twitter itself. Slack, Discord, LinkedIn and
   * several messaging clients read `twitter:card` to decide layout even when
   * they take their content from Open Graph.
   */
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  /**
   * Favicons, the touch icon and the manifest — all static files under
   * `public/brand/`, all cut from the one supplied mark.
   *
   * ---------------------------------------------------------------------------
   * WHY THESE ARE DECLARED HERE RATHER THAN LEFT TO THE FILE CONVENTION
   *
   * This used to be `app/icon.tsx` and `app/apple-icon.tsx` — two `ImageResponse`
   * routes drawing a purple "S" monogram, written as a placeholder when there
   * was no brand asset to point at. There is one now, so both files are gone.
   * A real mark beats a generated letterform, and a static PNG beats rendering
   * one per request.
   *
   * ---------------------------------------------------------------------------
   * WHY THE ICON IS NOT THE FULL LOGO
   *
   * `mark-dark.png` — the hand lifting a box, over two more on the floor — is
   * the site header logo and stays that way. It is NOT what these files are cut
   * from, and the difference is deliberate.
   *
   * Google renders a favicon at roughly 16px in a result row. Five separate
   * shapes at 16px is not a small logo, it is a grey smudge; downscaling the
   * full mark produced exactly that. So the icon is the CENTRE BOX ALONE,
   * which is the one element that still reads as an object at that size.
   *
   * Two marks, one brand. Do not "fix" this by pointing the icons back at
   * mark-dark.png — that regresses to the smudge.
   *
   * ---------------------------------------------------------------------------
   * WHY A SOLID TILE, AND WHY THAT KILLED THE LIGHT/DARK PAIR
   *
   * These used to be a monochrome mark on transparency, offered as a pair with
   * `media: (prefers-color-scheme: ...)` so black ink did not vanish into a dark
   * tab strip. Every one of those files is gone, because an OPAQUE tile — cream
   * box on brand purple — solves the same problem without the machinery:
   *
   *   - It is visible on any background, so one file serves light and dark.
   *   - It removes the trap that every `rel="icon"` carried a `media` filter,
   *     leaving a crawler that evaluates media with nothing to match.
   *   - Purple is load-bearing, not decoration. In a Google result list where
   *     nearly every favicon is dark-on-white, a coloured tile is the thing
   *     that gets the row noticed.
   *
   * ⚠ The touch icon and the manifest icons are FULL-BLEED squares with no
   * corner rounding of their own. iOS and Android apply their own mask; if we
   * rounded first, the corners would be cut twice and show gaps. The manifest
   * pair additionally carries ~20% padding to stay inside Android's maskable
   * safe zone. Do not crop that padding out to make the art look bigger.
   *
   * Sizes are 16/32/48/96 because Google asks for multiples of 48 and rescales
   * to ~16; 48 and 96 exist so it never has to upscale a 32.
   *
   * `/favicon.ico` (16/32/48, same art) stays at the web root as the
   * unconditional fallback, for clients that request it by path and ignore
   * <link> tags entirely — feed readers, chat unfurlers, bookmark managers.
   */
  icons: {
    icon: [
      { url: "/brand/favicon-96.png", type: "image/png", sizes: "96x96" },
      { url: "/brand/favicon-48.png", type: "image/png", sizes: "48x48" },
      { url: "/brand/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/brand/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon.ico", sizes: "48x48 32x32 16x16" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",


  robots: {
    index: true,
    follow: true,
    /**
     * Explicit Googlebot directives. `max-image-preview: large` is the one that
     * matters commercially: without it Google renders product results with a
     * thumbnail rather than a full-width image, and this catalogue is entirely
     * photographed goods. The other two remove the default caps on snippet
     * length and video preview, which is what allows a verdict summary to be
     * quoted in full in a result.
     */
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  /**
   * Google Search Console ownership, as a META TAG.
   *
   * ⚠ This does NOT verify the `sortedchoice.com` **Domain** property. A Domain
   * property is verified by DNS TXT record and by nothing else — that is the
   * whole point of it, since it asserts ownership across every subdomain and
   * both protocols, which no single page can prove.
   *
   * This is the fallback path: it verifies a **URL-prefix** property added as
   * `https://www.sortedchoice.com`, which is worth having if the DNS record is
   * slow to propagate or the registrar panel is being difficult.
   *
   * The token is the DNS value with its `google-site-verification=` prefix
   * stripped — the meta tag carries that in `name`, and leaving the prefix in
   * the content is the usual reason a tag silently fails to verify.
   *
   * Not a secret. A verification token proves ownership only by virtue of being
   * published on the domain it names, so it is public by construction — it is
   * served in the HTML of every page here.
   */
  verification: {
    google: "Xeuz2vPDNcehDXpirhHO1rnkgSnqVXUFtsneN6iN1n8",
  },

  /**
   * ⚠ NO `alternates.canonical` HERE, deliberately.
   *
   * Next merges metadata down the tree, so a canonical on the root layout is
   * inherited by every page that does not set its own — and the pages that do
   * not set one are precisely the `noindex` ones: /login, /register, /search,
   * /account/**. Each would then declare itself canonical to `/`, which asks
   * Google to consolidate a noindexed document onto the homepage. That is the
   * documented way to accidentally deindex your own root.
   *
   * The homepage sets `canonical: "/"` in its own metadata instead, where it
   * applies to exactly one URL. `metadataBase` above is what normalises the
   * origin for every relative canonical, and it is not inherited-by-accident in
   * the same way — it is only ever a base, never a claim.
   *
   * ⚠ AND NOTE WHAT THIS RULES OUT, WHICH IS NOT OBVIOUS.
   *
   * Feed autodiscovery would naturally live here too, as
   * `alternates: { types: { "application/rss+xml": … } }`. It cannot, and the
   * reason is worth writing down because the failure is silent and inverted.
   *
   * Next does NOT merge the sub-keys of `alternates` — a route exporting
   * `alternates: { canonical }` replaces the whole object, feed entry included.
   * So a `types` declared here would appear on exactly the pages that set no
   * canonical of their own, which is precisely the noindex set: /login,
   * /register, /search, /account/**. Every page that matters would lose it.
   *
   * This was measured, not assumed: with `types` on the root layout, /login and
   * /search carried the feed link and /, /help and every product page did not.
   *
   * The feed `<link>` is therefore written directly into `<head>` in the JSX
   * below, where nothing merges it away.
   */
};

/**
 * Browser chrome colour. Light only, and deliberately not media-matched: the
 * page itself no longer follows `prefers-color-scheme` unless the reader has
 * explicitly chosen "system", so keying the chrome off the OS would paint a
 * dark address bar above a light page for every dark-OS visitor. This metadata
 * is static per route and cannot track the runtime `data-theme`, so it matches
 * the default the page actually renders.
 */
export const viewport: Viewport = {
  themeColor: "#f4f1ed",
};

/**
 * Root layout.
 *
 * **`data-scroll-behavior`.** globals.css sets `scroll-behavior: smooth` on
 * `<html>` so in-page anchor links glide. Next 15 and earlier silently forced
 * it back to `auto` for the duration of every route transition; Next 16 stopped
 * doing that unless this attribute is present (see their v16 upgrade guide).
 *
 * Without it a client-side navigation *animates* the scroll reset instead of
 * jumping, so any navigation that re-renders mid-animation — notably
 * `router.replace()` immediately followed by `router.refresh()`, which is
 * exactly what sign-in and sign-out do — changes the document height while the
 * browser is still scrolling and the animation settles far down the new page.
 * That is why signing in looked like it "redirected to the footer": the
 * destination was right, the scroll position was not.
 *
 * With the attribute, navigation jumps instantly again and anchor links stay
 * smooth.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The strict CSP admits only nonce-carrying scripts. Without this the theme
  // script would be blocked and every visitor would get a flash of light mode.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      // Required by Next 16 — see the note above the component.
      data-scroll-behavior="smooth"
      className={`${hanken.variable} ${inter.variable} ${geist.variable} ${geistMono.variable}`}
    >
      <head>
        {/* Applies the stored theme before first paint — no flash. Must stay
            inline and blocking; moving it to a component would be too late. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeInitScript }} />

        {/* Feed autodiscovery — the tag that makes /feed.xml findable at all.
            Browsers stopped showing a feed button years ago; the things that
            actually consume it did not. Readers, "follow" integrations,
            newsletter tooling, and the crawlers that poll a feed to learn what
            changed instead of re-walking the whole catalogue.

            Hand-written rather than declared through `alternates.types` — see
            the ⚠ note in the metadata export above for the measurement behind
            that. Every page advertises the SITE's feed, which is the convention:
            autodiscovery points at the publication, not at a feed of the
            current page. */}
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${SITE_NAME} — latest verdicts`}
          href="/feed.xml"
        />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast
                     focus:rounded-sm focus:bg-brand-fill focus:px-4 focus:py-2 focus:text-brand-on"
        >
          Skip to content
        </a>
        {children}
        {/* Mounted on the ROOT layout, not the site group, because "every page"
            has to include the ones with no chrome: /admin/**, the styleguide,
            and the error and not-found boundaries. It costs nothing on a short
            page — it stays parked until the reader is a viewport deep — and it
            docks above the footer and any fixed bar rather than over them. */}
        <BackToTop />
      </body>
    </html>
  );
}
