import Link from "next/link";

import { formatDate } from "@/lib/format";
import { jsonLd } from "@/lib/json-ld";
import { absoluteUrl } from "@/lib/site";

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
  path,
  schemaType = "WebPage",
  sections,
  footnote,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  /** ISO date. Rendered as the effective date — a policy without one is a rumour. */
  updated: string;
  /**
   * Site-relative path of this document, no origin. Used only for structured
   * data — see `<DocumentSchema>` below. Required rather than optional because
   * an untyped trust document is the specific thing this was added to fix, and
   * an optional prop is a prop that gets left off.
   */
  path: string;
  /**
   * schema.org type for the page. `WebPage` is right for a policy or a help
   * index — a document that states rules. Pass `"AboutPage"` for /about and
   * `"Article"` for the methodology pages, which are authored explanations
   * with a byline rather than reference material.
   */
  schemaType?: "WebPage" | "AboutPage" | "Article";
  sections: DocSection[];
  footnote?: React.ReactNode;
}) {
  return (
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

      <DocumentSchema
        title={title}
        lede={lede}
        updated={updated}
        path={path}
        schemaType={schemaType}
        sections={sections}
      />
    </main>

  );
}

/**
 * Structured data for a trust document.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE PAGES, WHICH NOBODY SEARCHES FOR, GET MARKUP AT ALL
 *
 * Nobody types "sortedchoice affiliate disclosure" into Google, and this markup
 * will not win a single click. That is not what it is for.
 *
 * These nine documents are the evidence for the one claim the entire site rests
 * on: that the verdicts are independent. Both Google's quality-rater guidance
 * and every answer engine's sourcing behaviour ask the same question of a
 * commercial recommendation — who is making it, on what stated basis, and when
 * did they last stand behind it. The homepage `Organization` already NAMES
 * these documents through `publishingPrinciples` and `ethicsPolicy`, but until
 * now the documents themselves answered back with nothing: an untyped page of
 * prose with a date rendered as a sentence.
 *
 * This closes the loop. Each document declares its own type, its publisher (the
 * same `@id` the Organization node uses, so the graph joins up rather than
 * describing two unrelated entities with the same name), and — the part that
 * actually matters — a machine-readable `dateModified`.
 *
 * ---------------------------------------------------------------------------
 * `dateModified` IS THE POINT
 *
 * A policy's credibility is almost entirely a function of its date. "In effect
 * from 20 August 2026" is rendered on the page, but it is rendered as prose, in
 * a locale-formatted string, inside a paragraph — a crawler can guess at it and
 * an assistant summarising the page will usually not bother.
 *
 * The `updated` prop is already an ISO date, already required by this
 * component, and already the single source for the visible line. Emitting it
 * here costs nothing and turns a guess into a fact.
 *
 * `hasPart` lists the numbered sections with their anchors, which is what lets
 * an answer engine cite a specific clause — /editorial-policy#corrections —
 * rather than the document as a whole. Deep-linking a policy is the difference
 * between "SortedChoice has an editorial policy" and a quotable rule.
 */
function DocumentSchema({
  title,
  lede,
  updated,
  path,
  schemaType,
  sections,
}: {
  title: string;
  lede: string;
  updated: string;
  path: string;
  schemaType: "WebPage" | "AboutPage" | "Article";
  sections: DocSection[];
}) {
  const url = absoluteUrl(path);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd({
          "@context": "https://schema.org",
          "@type": schemaType,
          "@id": `${url}#document`,
          url,
          name: title,
          headline: title,
          description: lede,
          /**
           * Both dates come from the one `updated` prop, and that is honest
           * rather than lazy: these documents are revised in place, so the
           * version in effect IS the version published. Inventing a separate
           * original publication date we do not record would be fabricating the
           * more load-bearing of the two.
           */
          datePublished: updated,
          dateModified: updated,
          inLanguage: "en-IN",
          isPartOf: { "@id": absoluteUrl("/#website") },
          publisher: { "@id": absoluteUrl("/#organization") },
          // The organisation is the author of its own policies. Named as the
          // same node rather than a fresh Organization object, so a crawler
          // merges this into the existing entity instead of inferring a second
          // publisher that happens to share our name.
          author: { "@id": absoluteUrl("/#organization") },
          about: { "@id": absoluteUrl("/#organization") },
          hasPart: sections.map((section) => ({
            "@type": "WebPageElement",
            "@id": `${url}#${section.id}`,
            name: section.title,
            url: `${url}#${section.id}`,
          })),
        }),
      }}
    />
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
