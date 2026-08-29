import type { Metadata } from "next";
import Link from "next/link";

import { GUIDES } from "@/content/guides";
import { formatDate } from "@/lib/format";
import { jsonLd } from "@/lib/json-ld";
import { absoluteUrl } from "@/lib/site";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CollectionPageJsonLd } from "@/components/seo/CollectionPageJsonLd";

export const metadata: Metadata = {
  /**
   * "Buying guides" and not "Blog".
   *
   * Nobody searches for a company's blog, and the word describes a format
   * rather than a subject. "Buying guides" is a phrase people type, it is the
   * phrase lib/seo.ts already uses for hub categories, and it tells a reader
   * arriving from a search result what these are before they read a word.
   */
  title: "Buying guides — the technical bits, explained",
  description:
    "Plain explanations of the specifications that decide what to buy — processors, graphics, and the marketing claims built on top of them.",
  alternates: { canonical: "/guides" },
};

/**
 * The guides index.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS NOT A CARD GRID
 *
 * Three articles in a grid of cards looks like a blog with two posts missing.
 * The same three as a numbered contents page looks like a publication with a
 * section — which is what this is, and which is the grammar /c and the
 * document pages already use here.
 *
 * It also lets each entry carry its own standfirst at full width. These
 * articles are chosen by subject, not browsed by thumbnail; a reader deciding
 * between the phone guide and the laptop guide needs a sentence, and a card
 * would give them a truncated one.
 */
export default function GuidesIndexPage() {
  return (
    <main id="main">
      <section className="relative overflow-hidden border-b border-line bg-bg">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

        <div className="shell relative py-12 lg:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Guides" }]} />

          <div className="mt-8 max-w-3xl">
            <p className="t-eyebrow mb-4">Guides</p>
            <h1 className="t-display text-ink">The technical bits, explained</h1>
            <p className="mt-6 max-w-2xl text-body-lg text-ink-muted">
              Before you can choose a product you have to understand the specification it is
              sold on — and most of those specifications are written to be misread. These are
              the explanations we wished existed while doing the research.
            </p>
          </div>
        </div>
      </section>

      <div className="shell-wide pb-24 pt-14 lg:pt-20">
        <ol className="max-w-4xl">
          {GUIDES.map((guide, i) => (
            <li key={guide.slug} className="border-b border-line first:border-t">
              <Link href={`/guides/${guide.slug}`} className="group block py-8">
                <div className="flex gap-5 sm:gap-8">
                  <span
                    className="tabular shrink-0 pt-1 font-mono text-label-xs tracking-[0.14em] text-ink-faint
                               transition-colors duration-fast group-hover:text-brand"
                    aria-hidden="true"
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0">
                    <p className="t-eyebrow mb-2">{guide.eyebrow}</p>
                    <h2 className="text-headline-md text-ink transition-colors duration-fast group-hover:text-brand">
                      {guide.heading}
                    </h2>
                    <p className="mt-3 max-w-2xl text-body-md text-ink-muted">{guide.dek}</p>

                    <p className="tabular mt-5 font-mono text-label-xs uppercase tracking-[0.14em] text-ink-subtle">
                      Updated{" "}
                      <time dateTime={guide.updated}>{formatDate(guide.updated)}</time>
                      <span aria-hidden="true" className="mx-3 text-ink-faint">/</span>
                      {guide.sections.length} sections
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ol>

        <p className="mt-12 max-w-2xl text-body-md text-ink-muted">
          Every guide ends where the research does — in the{" "}
          <Link
            href="/c"
            className="text-brand underline decoration-brand-line underline-offset-4"
          >
            categories
          </Link>{" "}
          it describes, ranked. If you would rather skip the explanation, that is a perfectly
          good place to start instead.
        </p>
      </div>

      <CollectionPageJsonLd
        path="/guides"
        name="Buying guides"
        description="Plain explanations of the specifications that decide what to buy."
        itemListId={`${absoluteUrl("/guides")}#list`}
      />

      {/*
        The list itself, as an ordered `ItemList` of the articles.

        Ordered rather than unordered because the sequence is editorial — see the
        note in content/guides/index.ts about why these are not sorted by date.
        `itemListOrder` states that explicitly; without it a crawler is entitled
        to assume the order is arbitrary and to reorder the items in any surface
        that reuses them, which would put the most specialised article first for
        a reader who has read none of them.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "ItemList",
            "@id": `${absoluteUrl("/guides")}#list`,
            name: "Buying guides",
            itemListOrder: "https://schema.org/ItemListOrderAscending",
            numberOfItems: GUIDES.length,
            itemListElement: GUIDES.map((guide, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: absoluteUrl(`/guides/${guide.slug}`),
              name: guide.heading,
            })),
          }),
        }}
      />
    </main>
  );
}
