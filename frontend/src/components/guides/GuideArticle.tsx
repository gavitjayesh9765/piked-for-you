import Link from "next/link";

import type { Guide } from "@/content/guides/types";
import { formatDate } from "@/lib/format";
import { jsonLd } from "@/lib/json-ld";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { NextRail } from "@/components/guides/NextRail";

/**
 * The layout every guide renders through.
 *
 * Structurally a cousin of components/layout/DocumentPage.tsx — same numbered
 * chapters, same pinned contents rail, same reason (six pages built six ways is
 * how a site starts feeling assembled rather than designed). What it adds is
 * everything an ARTICLE needs that a policy does not: a dated byline, the
 * answer block, the takeaways panel, the FAQ, the rail into the catalogue, and
 * a considerably heavier structured-data payload.
 *
 * It is a separate component rather than a `variant` prop on DocumentPage
 * because the two disagree about the one thing that matters most in each:
 * DocumentPage's `datePublished` and `dateModified` are deliberately the same
 * value (a policy is revised in place, so the version in effect IS the version
 * published — see its note). For an article that would be a lie, and it is the
 * lie that most damages an explainer: a revision date that equals the
 * publication date says the piece has never been updated, which for hardware
 * writing is a confession rather than a fact.
 */

/** Roughly how long this takes to read, from the rendered text. */
function readingMinutes(guide: Guide): number {
  /**
   * Counted from the SOURCE strings we hold, not from the rendered JSX.
   *
   * Walking the React tree would be more accurate and would also count the
   * chart labels, the table cells and the axis captions — a benchmark table is
   * two hundred "words" that nobody reads as prose, and including them inflates
   * every estimate on the site by several minutes. Prose-only undercounts
   * slightly, which is the correct direction to be wrong in: a reader who
   * finishes early is never annoyed.
   */
  const words =
    (guide.dek + guide.answer + guide.takeaways.join(" ")).split(/\s+/).length +
    guide.sections.length * 260 +
    guide.faqs.length * 60;

  return Math.max(3, Math.round(words / 220));
}

export function GuideArticle({ guide, all }: { guide: Guide; all: Guide[] }) {
  const url = absoluteUrl(`/guides/${guide.slug}`);
  const minutes = readingMinutes(guide);
  const related = guide.related
    .map((slug) => all.find((g) => g.slug === slug))
    .filter((g): g is Guide => Boolean(g));

  return (
    <main id="main">
      {/* --- Masthead ------------------------------------------------- */}
      <article>
        <header className="relative overflow-hidden border-b border-line bg-bg">
          <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

          <div className="shell relative py-12 lg:py-16">
            <Breadcrumbs
              items={[
                { label: "Home", href: "/" },
                { label: "Guides", href: "/guides" },
                { label: guide.heading },
              ]}
            />

            <div className="mt-8 max-w-3xl">
              <p className="t-eyebrow mb-4">{guide.eyebrow}</p>
              <h1 className="t-display text-ink">{guide.heading}</h1>
              <p className="mt-6 max-w-2xl text-body-lg text-ink-muted">{guide.dek}</p>

              {/*
                The byline, and it names the ORGANISATION rather than a person.

                That matches the `author: { "@id": … /#organization }` used on
                every other authored surface here — the product reviews, the
                methodology pages, the policies. Inventing a personal byline for
                the guides alone would put a second author entity in the graph
                for work produced by the same desk, and the entity a reader is
                being asked to trust is the publication.
              */}
              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-label-xs uppercase tracking-[0.14em] text-ink-subtle">
                <span className="text-ink-muted">{SITE_NAME} research desk</span>
                <span aria-hidden="true" className="text-ink-faint">/</span>
                <span className="tabular">
                  Updated{" "}
                  <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>
                </span>
                <span aria-hidden="true" className="text-ink-faint">/</span>
                <span className="tabular">{minutes} min read</span>
              </div>
            </div>
          </div>
        </header>

        <div className="shell-wide pb-24 pt-14 lg:pt-20">
          <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
            {/* --- Contents rail ------------------------------------- */}
            <nav aria-label="On this page" className="lg:sticky lg:top-32 lg:self-start">
              <p className="t-eyebrow border-b border-line pb-3">Contents</p>
              <ol className="mt-1">
                {guide.sections.map((s, i) => (
                  <li key={s.id} className="border-b border-line-faint">
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
                <li className="border-b border-line-faint last:border-b-0">
                  <Link
                    href="#questions"
                    className="group flex items-baseline gap-3 py-2.5 text-body-sm text-ink-muted
                               transition-colors duration-fast hover:text-brand"
                  >
                    <span
                      className="tabular shrink-0 font-mono text-label-xs tracking-[0.14em] text-ink-faint
                                 transition-colors duration-fast group-hover:text-brand"
                      aria-hidden="true"
                    >
                      ??
                    </span>
                    <span>Common questions</span>
                  </Link>
                </li>
              </ol>
            </nav>

            {/* --- Body ---------------------------------------------- */}
            <div className="min-w-0">
              {/*
                THE ANSWER BLOCK.

                First thing under the headline, before any section, stated flat.
                Two audiences, one component:

                  - A reader who came from a search result wanting one fact and
                    will leave in nine seconds either way. Making them read four
                    paragraphs to find out whether Snapdragon beats Dimensity
                    does not keep them; it just means they leave without the
                    answer AND without a good opinion of us.

                  - An answer engine looking for the highest-confidence
                    extractive span on the page. See the note on `Guide.answer`
                    — this is the entire strategy, and its position at the top
                    of the document is half of why it works.

                It is a `<p>` inside a bordered aside rather than a blockquote:
                a quote element would assert that we are quoting somebody.
              */}
              <aside className="rounded-lg border-l-2 border-l-brand border-y border-r border-line bg-brand-soft/40 px-6 py-5">
                <p className="t-eyebrow mb-3">The short answer</p>
                <p className="text-body-lg text-ink">{guide.answer}</p>
              </aside>

              {/* Takeaways */}
              <section className="mt-10 rounded-lg border border-line bg-surface-0 px-6 py-5">
                <p className="t-eyebrow mb-4">What this guide establishes</p>
                <ul className="doc-prose !max-w-none">
                  {guide.takeaways.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </section>

              {/* Numbered chapters */}
              {guide.sections.map((s, i) => (
                <section key={s.id} id={s.id} className="mt-14 scroll-mt-32">
                  <div className="flex items-baseline gap-4 border-b border-line pb-4">
                    <span
                      className="tabular font-mono text-label-xs font-medium tracking-[0.14em] text-ink-faint"
                      aria-hidden="true"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-headline-md text-ink">{s.title}</h2>
                  </div>
                  <div className="doc-prose mt-6 !max-w-none">{s.body}</div>
                </section>
              ))}

              {/* --- FAQ ------------------------------------------------
                  Rendered as real headings and paragraphs, and marked up as
                  `FAQPage` by the component below. See FaqJsonLd's own note for
                  why that markup is worth emitting in 2026 despite Google
                  having withdrawn the rich result: the consumers that did not
                  withdraw anything are the ones this site is optimising for. */}
              <section id="questions" className="mt-14 scroll-mt-32">
                <div className="flex items-baseline gap-4 border-b border-line pb-4">
                  <span
                    className="tabular font-mono text-label-xs font-medium tracking-[0.14em] text-ink-faint"
                    aria-hidden="true"
                  >
                    ??
                  </span>
                  <h2 className="text-headline-md text-ink">Common questions</h2>
                </div>

                <dl className="mt-6">
                  {guide.faqs.map((faq) => (
                    <div key={faq.question} className="border-b border-line-faint py-5 last:border-b-0">
                      <dt className="text-headline-sm text-ink">{faq.question}</dt>
                      <dd className="doc-prose mt-3 !max-w-none">{faq.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              {/* --- Into the catalogue -------------------------------- */}
              <NextRail links={guide.next} />

              {/* --- The rest of the cluster --------------------------- */}
              {related.length > 0 ? (
                <section className="mt-16 border-t border-line pt-8">
                  <p className="t-eyebrow mb-5">Also in this series</p>
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {related.map((r) => (
                      <li key={r.slug}>
                        <Link
                          href={`/guides/${r.slug}`}
                          className="group block h-full rounded-lg border border-line bg-surface-0 px-5 py-4
                                     transition-colors duration-fast hover:border-brand-line"
                        >
                          <p className="text-body-md font-medium text-ink transition-colors duration-fast group-hover:text-brand">
                            {r.heading}
                          </p>
                          <p className="mt-1.5 text-body-sm text-ink-subtle">{r.dek}</p>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {/*
                The standing caveat.

                Every one of these articles ranks hardware, and hardware
                rankings rot — a generation ships and the top of the chart is
                wrong. Saying so in the article is not a hedge that weakens it;
                it is the thing that makes the rest of the numbers believable,
                and it is the same argument the affiliate disclosure makes about
                the verdicts. It also gives a reader who arrives in 2028 via a
                stale link the information they most need, which is the date.
              */}
              <aside className="mt-16 border-t-2 border-brand pt-6">
                <div className="doc-prose !max-w-none">
                  <p>
                    <strong>On these figures.</strong> Benchmark numbers here are medians of
                    publicly published runs, not our own lab results — each chart names its
                    source and the date it was last checked. They are a guide to relative
                    standing, not a promise about the specific unit you buy: the same chip in
                    two different bodies can differ by a fifth once heat and power limits are
                    accounted for, which is a point{" "}
                    <Link
                      href="/how-we-score"
                      className="text-brand underline decoration-brand-line underline-offset-4"
                    >
                      our scoring
                    </Link>{" "}
                    weighs directly. This page was last revised on{" "}
                    <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>; if a newer
                    generation has shipped since, treat the top of each chart as incomplete.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </article>

      <GuideSchema guide={guide} url={url} minutes={minutes} />
      <FaqJsonLd items={guide.faqs} path={`/guides/${guide.slug}`} />
    </main>
  );
}

/**
 * Structured data for a guide.
 *
 * ---------------------------------------------------------------------------
 * WHY `TechArticle` AND NOT `Article` OR `BlogPosting`
 *
 * `BlogPosting` is wrong and would be the default choice. It types the page as
 * a dated entry in a stream — the correct shape for news and the wrong one
 * here, because it carries an implicit "superseded by later posts" that is
 * exactly backwards for an evergreen explainer we intend to revise in place for
 * years. A `BlogPosting` from 2026 read in 2028 is presumed stale; a
 * `TechArticle` with a 2028 `dateModified` is presumed current.
 *
 * `TechArticle` also takes `proficiencyLevel` and `dependencies`, and the first
 * of those is doing real work: it tells an answer engine that this page
 * explains a subject to a beginner, which is what makes it a candidate for
 * "what is X" rather than only for "X vs Y".
 *
 * ---------------------------------------------------------------------------
 * `about` VERSUS `mentions`, WHICH ARE NOT INTERCHANGEABLE
 *
 * `about` is what the page IS about — here, the catalogue categories the
 * article feeds. There are one or two per guide and they are the entity we want
 * this page associated with.
 *
 * `mentions` is everything else discussed substantively — the manufacturers.
 * Both are pointed at our OWN URLs rather than at Wikipedia or a manufacturer
 * site, which is the part worth being deliberate about: an internal link in
 * structured data asserts that we have a page about that entity, and every one
 * of these resolves to a real brand or category page carrying its own markup.
 * Pointing `mentions` at wikipedia.org would help Wikipedia disambiguate an
 * entity Google already has no trouble with, and would do nothing for us.
 *
 * See the note on `Guide.entities` about not stuffing this.
 */
function GuideSchema({ guide, url, minutes }: { guide: Guide; url: string; minutes: number }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd({
          "@context": "https://schema.org",
          "@type": "TechArticle",
          "@id": `${url}#article`,
          url,
          mainEntityOfPage: { "@type": "WebPage", "@id": url },

          headline: guide.heading,
          alternativeHeadline: guide.dek,
          description: guide.description,
          /**
           * The answer block, verbatim.
           *
           * `abstract` is the field a summariser reaches for first, and giving
           * it the same sentence the page renders at the top means the summary
           * and the page agree by construction — the same discipline FaqJsonLd
           * enforces by deriving its answers from the rendered JSX.
           */
          abstract: guide.answer,

          datePublished: guide.published,
          dateModified: guide.updated,
          inLanguage: "en-IN",
          isAccessibleForFree: true,
          proficiencyLevel: "Beginner",

          isPartOf: { "@id": absoluteUrl("/#website") },
          publisher: { "@id": absoluteUrl("/#organization") },
          author: { "@id": absoluteUrl("/#organization") },

          /**
           * Word count is honest-ish and deliberately absent; `timeRequired` is
           * the one a reader-facing surface actually uses, and it matches the
           * "N min read" rendered in the byline rather than being a second
           * estimate computed differently.
           */
          timeRequired: `PT${minutes}M`,

          about: guide.entities.categories.map((path) => ({
            "@type": "Thing",
            "@id": absoluteUrl(path),
            url: absoluteUrl(path),
          })),
          mentions: guide.entities.brands.map((slug) => ({
            "@type": "Brand",
            "@id": absoluteUrl(`/b/${slug}`),
            url: absoluteUrl(`/b/${slug}`),
          })),

          /**
           * Section anchors, so a specific chapter can be cited rather than the
           * article as a whole — the same reasoning DocumentPage gives for
           * `hasPart` on the policies, and it matters more here. "SortedChoice
           * explains CPU suffixes" is worth little; a citation that lands on
           * /guides/laptop-processors-explained#suffixes is a reader.
           */
          hasPart: guide.sections.map((section) => ({
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
