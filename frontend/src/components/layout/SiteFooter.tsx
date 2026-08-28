import Link from "next/link";

import {
  AMAZON_ASSOCIATES_DISCLOSURE,
  AMAZON_TRADEMARK_NOTICE,
  FLIPKART_TRADEMARK_NOTICE,
} from "@/lib/legal";

import { BrandMark } from "./BrandMark";

/**
 * Footer. Carries the affiliate disclosure, which spec §59 requires to be
 * visible on any page that links out to a retailer — i.e. effectively every
 * page, so it lives here rather than being sprinkled per-template.
 *
 * ---------------------------------------------------------------------------
 * THE STRIP AT THE BOTTOM IS NOT COPY, IT IS COMPLIANCE
 *
 * Three separate obligations land in the same six lines, and they are not
 * interchangeable with each other or with our own wording:
 *
 *   - The MATERIAL CONNECTION disclosure (FTC Endorsement Guides; the Indian
 *     Department of Consumer Affairs' 2023 endorsement guidelines). Ours, in
 *     our voice, as long as it says the link is paid and costs the reader
 *     nothing.
 *   - The AMAZON ASSOCIATES statement, which is prescribed verbatim by the
 *     Operating Agreement and is not ours to rephrase. See lib/legal.ts.
 *   - The TRADEMARK notices, which stop "Amazon" and "Flipkart" appearing all
 *     over a commercial site with no attribution.
 *
 * All three must be on every page that carries an outbound retailer link,
 * which is effectively every page — hence here, and hence not conditional on
 * whether the page above happens to have rendered a buy button.
 */
const columns = [
  {
    title: "Explore",
    links: [
      { label: "All categories", href: "/c" },
      { label: "Top Picks", href: "/top-picks" },
      { label: "Brands", href: "/b" },
      { label: "Compare products", href: "/compare" },
    ],
  },
  {
    title: "About",
    links: [
      { label: "Our story", href: "/about" },
      { label: "How we research", href: "/how-we-research" },
      { label: "How we score", href: "/how-we-score" },
      { label: "Editorial policy", href: "/editorial-policy" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "/help" },
      { label: "Report a review", href: "/help/report" },
      { label: "Affiliate disclosure", href: "/affiliate-disclosure" },
      { label: "Grievance redressal", href: "/grievance" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Cookie policy", href: "/cookies" },
      { label: "Disclaimer", href: "/disclaimer" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-section border-t border-line bg-surface-1">
      <div className="shell grid gap-12 py-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)]">
        <div className="max-w-sm">
          <Link
            href="/"
            className="flex items-center gap-3 font-display text-[1.6rem] font-black tracking-[-0.045em] text-ink"
          >
            {/* Not `priority` — by the time anyone reaches the footer the page
                has long since painted, and a preload here would compete with
                the header's copy of the same two files for no gain. */}
            <BrandMark size={38} priority={false} />
            SortedChoice
          </Link>
          <p className="mt-4 text-body-sm text-ink-muted">
            We research products so you can choose with confidence. Independent verdicts,
            structured comparisons, and real community experience — then you decide where to buy.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {columns.map((col) => (
            <div key={col.title}>
              <h2 className="t-eyebrow">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-body-sm text-ink-muted transition-colors duration-fast hover:text-brand"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Affiliate disclosure — required, and deliberately plain-spoken (spec §59) */}
      <div className="border-t border-line">
        <div className="shell flex flex-col gap-3 py-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-label-xs leading-relaxed text-ink-subtle">
              SortedChoice does not sell products. When you follow a link to Amazon or Flipkart we
              may earn a commission, at no extra cost to you. That never influences a verdict — our
              recommendations are written before any retailer link is attached.{" "}
              <Link href="/affiliate-disclosure" className="underline hover:text-brand">
                Full disclosure
              </Link>
              .
            </p>
            {/* ⚠ Prescribed wording. Not ours to edit — see lib/legal.ts. */}
            <p className="text-label-xs leading-relaxed text-ink-subtle">
              {AMAZON_ASSOCIATES_DISCLOSURE}
            </p>
            <p className="text-label-xs leading-relaxed text-ink-faint">
              {AMAZON_TRADEMARK_NOTICE} {FLIPKART_TRADEMARK_NOTICE} All other product names, logos
              and brands are the property of their respective owners and are used for
              identification only.
            </p>
            <p className="text-label-xs leading-relaxed text-ink-faint">
              Verdicts and scores are our editorial opinion and may not suit every buyer — see the{" "}
              <Link href="/disclaimer" className="underline hover:text-ink-subtle">
                disclaimer
              </Link>
              .
            </p>
          </div>
          <p className="shrink-0 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
            © {new Date().getFullYear()} SortedChoice
          </p>
        </div>
      </div>
    </footer>
  );
}
