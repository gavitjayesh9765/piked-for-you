import type { Metadata } from "next";
import Link from "next/link";

import { getCategories } from "@/lib/api";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata: Metadata = {
  title: "Ask the desk",
  description:
    "Request a product review, correct a verdict, or get in touch. We reply to real people — brands cannot pay to be reviewed.",
  alternates: { canonical: "/contact" },
};

/**
 * Contact page.
 *
 * Framed as a research desk intake rather than a support form — the most
 * valuable thing arriving in this inbox is "help me decide what to buy", which
 * is the product's entire reason for existing.
 *
 * Categories come from the API, so the multi-select stays in sync with whatever
 * the admin has published (spec §6, §54).
 */
export default async function ContactPage() {
  const categories = await getCategories();

  return (
    <main id="main">
      {/* --- Full-bleed editorial header --- */}
      <section className="relative overflow-hidden border-b border-line bg-surface-1">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="shell-wide relative py-16 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-end lg:gap-16">
            <div className="max-w-2xl">
              <p className="t-eyebrow mb-4 flex items-center gap-2">
                <span className="inline-block h-px w-6 bg-brand" />
                Contact
              </p>
              <h1 className="t-display text-ink">Ask the desk.</h1>
              <p className="mt-6 max-w-xl text-body-lg text-ink-muted">
                Stuck between two products? Spotted something we got wrong? Tell us what you need
                and a person will get back to you — this inbox is read, not triaged by a bot.
              </p>
            </div>

            {/* Trust panel — the thing a research site has to say up front */}
            <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
                ["Typical reply", "2–3 days"],
                ["Paid placements", "None, ever"],
                ["Requests answered", "100%"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-baseline justify-between gap-4 bg-surface-0 px-5 py-4"
                >
                  <span className="t-eyebrow">{label}</span>
                  <span className="font-mono text-body-md tabular-nums text-ink">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* --- The form --- */}
      <div className="shell-wide py-14 lg:py-20">
        <ContactForm categories={categories} />
      </div>

      {/* --- Deflection: answer the common asks before they're typed --- */}
      <section className="border-t border-line bg-surface-1">
        <div className="shell-wide py-16">
          <div className="max-w-2xl">
            <p className="t-eyebrow mb-3">Before you write</p>
            <h2 className="t-headline text-ink">Some of this is already answered.</h2>
          </div>

          <div
            className="mt-10 grid gap-8"
            style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(260px, 100%), 1fr))" }}
          >
            {[
              {
                q: "Do brands pay to appear?",
                a: "No. We earn a commission when you buy through a retailer link, and that never influences a verdict — recommendations are written before any link is attached.",
                href: "/affiliate-disclosure",
                cta: "Affiliate disclosure",
              },
              {
                q: "How do you score products?",
                a: "Category-specific criteria, applied consistently, so a comparison actually compares. The PickD Score is ours and is never merged with community ratings.",
                href: "/how-we-research",
                cta: "How we research",
              },
              {
                q: "Can I sell on PickDForYou?",
                a: "There's nothing to sell on — we're a research desk, not a marketplace. We don't hold inventory or process payments.",
                href: "/about",
                cta: "Our story",
              },
              {
                q: "My review was removed.",
                a: "Everything is moderated before publishing, and we remove content that breaks the guidelines. Use “Something else” above and quote the product.",
                href: "/help",
                cta: "Help centre",
              },
            ].map((item) => (
              <div key={item.q} className="border-t border-line pt-6">
                <h3 className="text-headline-sm text-ink">{item.q}</h3>
                <p className="mt-2.5 text-body-sm text-ink-muted">{item.a}</p>
                <Link
                  href={item.href}
                  className="group mt-4 inline-flex items-center gap-2 font-label text-label-xs uppercase tracking-[0.1em] text-brand"
                >
                  {item.cta}
                  <span className="transition-transform duration-fast ease-ease group-hover:translate-x-1">
                    →
                  </span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>

  );
}
