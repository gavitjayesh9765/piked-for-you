import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Hanken_Grotesk, Inter, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/components/layout/ThemeToggle";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

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
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_IN",
    url: "/",
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
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
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
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
   * A real 512px mark beats a generated letterform, and a static PNG beats
   * rendering one per request.
   *
   * With the artwork in `public/`, the file convention no longer applies, so the
   * <link> tags have to be declared. That is also what makes the pair below
   * possible, which the convention could not express.
   *
   * ---------------------------------------------------------------------------
   * THE LIGHT/DARK PAIR, AND ITS ONE LIMITATION
   *
   * The mark is monochrome: `mark-dark.png` is near-black ink, `mark-light.png`
   * is near-white, both on transparency. A single one of them is invisible in
   * half of all browser chrome — black ink vanishes into a dark tab strip — so
   * both are offered and `media` lets the browser pick.
   *
   * ⚠ That `media` query is `prefers-color-scheme`, i.e. the OS setting. It is
   * NOT this site's theme: the toggle writes `data-theme` on <html>, and no
   * amount of it reaches browser chrome. So a reader on a light OS who switches
   * the page to dark keeps the dark-ink favicon. That is correct — the icon
   * lives in the tab strip, which is still light — and it is worth stating
   * because it looks like a bug the first time you notice it.
   *
   * `/favicon.ico` (dark ink) stays at the web root as the unconditional
   * fallback, for the clients that request it by path and ignore <link> tags
   * entirely — feed readers, chat unfurlers, older bookmark managers.
   *
   * The Apple touch icon is the LIGHT-ink cut on purpose. iOS ignores the alpha
   * channel and composites the tile onto black, so the dark cut would render as
   * a black mark on a black square.
   */
  icons: {
    icon: [
      { url: "/brand/favicon-32-dark.png", type: "image/png", sizes: "32x32", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon-16-dark.png", type: "image/png", sizes: "16x16", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon-32-light.png", type: "image/png", sizes: "32x32", media: "(prefers-color-scheme: dark)" },
      { url: "/brand/favicon-16-light.png", type: "image/png", sizes: "16x16", media: "(prefers-color-scheme: dark)" },
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
      </body>
    </html>
  );
}
