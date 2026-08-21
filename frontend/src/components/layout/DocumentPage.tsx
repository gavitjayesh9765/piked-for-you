import Link from "next/link";

import { getCategories } from "@/lib/api";
import { formatDate } from "@/lib/format";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

/**
 * The shared layout for every long-form page — policies, disclosures, the
 * story. Six pages built six ways is how a site starts feeling assembled
 * rather than designed, so they all come through here.
 *
 * The contents rail is the part that earns its keep. A policy is a reference
 * document: people arrive looking for one clause, not to read it end to end.
 * Numbering the sections and pinning them alongside the prose turns a wall of
 * text into something you can actually navigate, and it reuses the same
 * numbered-chapter grammar as /c and /how-we-research so the whole publication
 * reads as one voice.
 */

export type DocSection = {
  /** Anchor id — also the deep link people paste when citing a clause. */
  id: string;
  title: string;
  body: React.ReactNode;
};

export async function DocumentPage({
  eyebrow,
  title,
  lede,
  updated,
  sections,
  footnote,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  /** ISO date. Rendered as the effective date — a policy without one is a rumour. */
  updated: string;
  sections: DocSection[];
  footnote?: React.ReactNode;
}) {
  const categories = await getCategories();

  return (
    <>
      <SiteHeader categories={categories} />

      <main id="main">
        {/* --- Masthead ------------------------------------------------ */}
        <section className="relative overflow-hidden border-b border-line bg-bg">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

          <div className="shell relative py-12 lg:py-16">
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: title }]} />

            <div className="mt-8 max-w-3xl">
              <p className="t-eyebrow mb-4">{eyebrow}</p>
              <h1 className="t-display text-ink">{title}</h1>
              <p className="mt-6 max-w-xl text-body-lg text-ink-muted">{lede}</p>
              <p className="tabular mt-8 font-mono text-label-xs uppercase tracking-[0.14em] text-ink-subtle">
                In effect from {formatDate(updated)}
              </p>
            </div>
          </div>
        </section>

        {/* --- Body ---------------------------------------------------- */}
        <div className="shell-wide pb-24 pt-14 lg:pt-20">
          <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            {/* Contents — pinned on wide screens, inline on narrow ones. */}
            <nav aria-label="On this page" className="lg:sticky lg:top-32 lg:self-start">
              <p className="t-eyebrow border-b border-line pb-3">Contents</p>
              <ol className="mt-1">
                {sections.map((s, i) => (
                  <li key={s.id} className="border-b border-line-faint last:border-b-0">
                    <Link
                      href={`#${s.id}`}
                      className="group flex items-baseline gap-3 py-2.5 text-body-sm text-ink-muted
                                 transition-colors duration-fast hover:text-brand"
                    >
                      <span
                        className="tabular shrink-0 font-mono text-label-xs tracking-[0.14em] text-ink-faint
                                   transition-colors duration-fast group-hover:text-brand"
                        aria-hidden="true"
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s.title}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Prose */}
            <div className="min-w-0">
              {sections.map((s, i) => (
                <section key={s.id} id={s.id} className="mt-14 scroll-mt-32 first:mt-0">
                  <div className="flex items-baseline gap-4 border-b border-line pb-4">
                    <span
                      className="tabular font-mono text-label-xs font-medium tracking-[0.14em] text-ink-faint"
                      aria-hidden="true"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-headline-md text-ink">{s.title}</h2>
                  </div>
                  <div className="doc-prose mt-6">{s.body}</div>
                </section>
              ))}

              {footnote ? (
                <aside className="mt-16 border-t-2 border-brand pt-6">
                  <div className="doc-prose">{footnote}</div>
                </aside>
              ) : null}
            </div>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

/** Inline link styling for use inside document prose. */
export function DocLink({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith("http") || href.startsWith("mailto:");
  const className =
    "text-brand underline decoration-brand-line underline-offset-4 transition-colors duration-fast hover:decoration-brand";

  if (external) {
    return (
      <a href={href} className={className} rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
