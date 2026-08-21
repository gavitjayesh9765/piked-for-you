import Link from "next/link";

/**
 * Footer. Carries the affiliate disclosure, which spec §59 requires to be
 * visible on any page that links out to a retailer — i.e. effectively every
 * page, so it lives here rather than being sprinkled per-template.
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
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy policy", href: "/privacy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Cookie policy", href: "/cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-section border-t border-line bg-surface-1">
      <div className="shell grid gap-12 py-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,3fr)]">
        <div className="max-w-sm">
          <Link href="/" className="font-display text-[1.6rem] font-black tracking-[-0.045em] text-ink">
            PickDForYou
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
        <div className="shell flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-label-xs leading-relaxed text-ink-subtle">
            PickDForYou does not sell products. When you follow a link to Amazon or Flipkart we may
            earn a commission, at no extra cost to you. That never influences a verdict — our
            recommendations are written before any retailer link is attached.
          </p>
          <p className="shrink-0 font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
            © {new Date().getFullYear()} PickDForYou
          </p>
        </div>
      </div>
    </footer>
  );
}
