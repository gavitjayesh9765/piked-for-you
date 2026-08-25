import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Hanken_Grotesk, Inter, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { themeInitScript } from "@/components/layout/ThemeToggle";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://sortedchoice.com"),
  title: {
    default: "SortedChoice — We research products so you can choose with confidence",
    template: "%s · SortedChoice",
  },
  description:
    "Independent product research, comparisons and verdicts. Stop spending hours researching — see what's actually worth buying, and why.",
  openGraph: {
    type: "website",
    siteName: "SortedChoice",
    locale: "en_IN",
  },
  robots: { index: true, follow: true },
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
