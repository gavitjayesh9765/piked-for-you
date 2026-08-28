import type { Metadata } from "next";
import Link from "next/link";

import { getProduct, getTopPicks } from "@/lib/api";
import { productHref } from "@/lib/format";
import type { Product } from "@/lib/types";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ScoreRing } from "@/components/product/ScoreRing";
import { jsonLd } from "@/lib/json-ld";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "How we research",
  description:
    "What goes into a PickD Score, what cannot buy its way in, and a worked example using a real verdict.",
  alternates: { canonical: "/how-we-research" },
};

/**
 * When the METHOD last changed — not when this file last did.
 *
 * ⚠ Bump this only when the rubric, the pipeline or the commitments below
 * actually change. Editing a sentence for clarity is not a methodology
 * revision, and treating it as one makes the date meaningless in exactly the
 * document where it carries the most weight: this is the page an evaluator
 * reads to decide whether the verdicts are worth believing, and a methodology
 * dated "today, every day" reads as one nobody is really maintaining.
 *
 * Matches the convention in every sibling trust document — see the `UPDATED`
 * constant in /editorial-policy, /affiliate-disclosure and the rest. Those go
 * through <DocumentPage>, which renders the date and emits it as
 * `dateModified`; this page is hand-built, so it does both jobs itself below.
 */
const UPDATED = "2026-08-28";

/**
 * The chapters, mirrored as data for the structured-data block.
 *
 * ⚠ These ids and titles are duplicated from the <Chapter> calls in the JSX,
 * which is a compromise: the chapters are interleaved with live product data
 * and one of them renders conditionally, so there is no single array the page
 * could map over without restructuring the whole body. Kept adjacent to the
 * page it describes rather than in the schema component, so the two are edited
 * in the same screenful. If a chapter is renamed or added, update both.
 */
const CHAPTERS = [
  { id: "commitments", title: "What we will not do" },
  { id: "method", title: "How a verdict gets made" },
  { id: "example", title: "A real one, taken apart" },
  { id: "two-numbers", title: "Two numbers, kept apart" },
  { id: "money", title: "How we pay for this" },
];

/**
 * How we research (spec §35).
 *
 * This page is the load-bearing one for the whole proposition — the hero CTA
 * points here, and "no sponsored verdicts" is worth nothing if the method
 * behind it is a paragraph of adjectives.
 *
 * So it does not describe the method, it *shows* it: §4 pulls a live product
 * and renders the actual criteria behind its actual score. Nothing on this
 * page is illustrative. If the rubric changes, the page changes with it,
 * which is the only version of a methodology page that can stay honest.
 */

const COMMITMENTS = [
  {
    title: "No brand can buy a verdict.",
    body: "Not a placement, not a score, not a position on the board. There is no rate card because there is nothing on sale.",
  },
  {
    title: "The verdict is written before the link.",
    body: "Research finishes, the verdict is written, and only then does anyone attach a retailer link. The order matters, and it is not negotiable.",
  },
  {
    title: "We say when something is not worth it.",
    body: "A recommendation nobody can fail is not a recommendation. If the answer is 'buy the cheaper one' or 'wait', that is what it says.",
  },
  {
    title: "Your rating and our score never merge.",
    body: "The PickD Score is ours and is measured. The community rating is yours and is reported. Averaging them into one number would hide both.",
  },
] as const;

/**
 * The pipeline, as it is actually run.
 *
 * ⚠ These are stages of work, not a marketing ladder. Each one exists because
 * it catches something the one before it cannot: the manual read catches spec
 * errors, the multi-source pass catches one reviewer's taste, owner reports
 * catch month-eight failures, hands-on catches what no write-up records, and
 * the adversarial AI pass catches our own thin reasoning. If a stage stops
 * being run, it comes out of this list — a published method nobody follows is
 * worse than no published method.
 */
const STAGES = [
  {
    title: "Set the rubric before anything is opened",
    body: "What counts is decided per category, in advance. Headphones are judged on noise cancellation and call quality; a laptop on thermals and battery. Deciding what matters after seeing the contenders is how a favourite quietly gets a rubric built around it.",
  },
  {
    title: "Do the reading by hand",
    body: "Someone sits with the primary material — spec sheets, manuals, teardowns, independent measurements, the fine print on the retailer listing. It is slow and it is not delegated, and it is where most of the errors that would survive every later stage get caught.",
  },
  {
    title: "Watch the reviews. Plural.",
    body: "Long-form video and written reviews from several independent sources, picked to disagree with each other rather than to agree with us. One reviewer's verdict is one pair of ears, one desk, one review unit. A claim is not evidence until it survives more than one of them.",
  },
  {
    title: "Read the owners, not the launch week",
    body: "Owner reports across retailers, forums and communities, read for pattern rather than sentiment: the hinge that fails at month eight, the app that got worse after an update. Launch coverage cannot see any of that, and one furious review is not a fault.",
  },
  {
    title: "Use it ourselves where we can",
    body: "Some of what we cover we buy, borrow, or already own — and then it gets lived with rather than unboxed. Hands-on changes a verdict more than anything else on this list, so we say plainly when it happened and never imply it when it did not.",
  },
  {
    title: "Argue the case with an AI, on purpose",
    body: "The assembled evidence is put to an AI model and pushed back on: what have we missed, which claim is thinly sourced, what is the strongest case against the conclusion we are heading towards. It is a tireless second reader, and it is checked exactly like any other source. It scores nothing and it writes nothing.",
    link: { href: "/editorial-policy#ai", label: "Our policy on automated tools" },
  },
  {
    title: "Score each criterion on its own",
    body: "Every criterion is scored from 0 to 10 against the category rubric, not against the other products in the round-up. A weak field does not promote a mediocre product.",
  },
  {
    title: "Write the verdict a person can be held to",
    body: "One line on who this is for, one on who should skip it, and the reason attached to both. If neither line can be written yet, the research is not finished and nothing is published.",
  },
  {
    title: "Revisit when the facts move",
    body: "Prices move, firmware changes behaviour, successors arrive. A score carries the date it was last reviewed so you can judge how much of it is still true.",
  },
] as const;

export default async function HowWeResearchPage() {
  const section = await getTopPicks();

  // The worked example is a real, currently-published verdict rather than a
  // fixture — a methodology page illustrated with invented numbers would be
  // the exact thing it is asking you not to worry about.
  //
  // The summary shape only carries `score.overall`, so the criteria have to come
  // from the full record. Walk the first few picks and take the first that
  // actually has a rubric attached; if none do, §03 simply does not render
  // rather than showing an empty chart.
  const candidates = (section?.products ?? []).slice(0, 3);
  const fetched = await Promise.all(
    candidates.map((p) => getProduct(p.category.slug, p.slug)),
  );
  const example: Product | null =
    fetched.find((p): p is Product => (p?.score?.criteria?.length ?? 0) > 0) ?? null;
  const criteria = example?.score?.criteria ?? [];

  return (
    <main id="main">
      {/* --- Masthead ------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-line bg-bg">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

        <div className="shell relative py-12 lg:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "How we research" }]} />

          <div className="mt-8 max-w-3xl">
            <p className="t-eyebrow mb-4">The method</p>
            <h1 className="t-display text-ink">
              How we research.
            </h1>
            <p className="mt-6 max-w-xl text-body-lg text-ink-muted">
              Every recommendation on this site is an opinion with a paper trail. This page is
              the paper trail.
            </p>
          </div>
        </div>
      </section>

      <div className="shell-wide pb-24 pt-14 lg:pt-20">
        {/* --- 1. Commitments --------------------------------------- */}
        <Chapter number="01" title="What we will not do" id="commitments">
          <ul className="grid gap-x-14 gap-y-10 sm:grid-cols-2">
            {COMMITMENTS.map((c) => (
              <li key={c.title} className="border-t-2 border-brand pt-5">
                <h3 className="text-headline-sm text-ink">{c.title}</h3>
                <p className="mt-2.5 text-body-sm text-ink-muted">{c.body}</p>
              </li>
            ))}
          </ul>
        </Chapter>

        {/* --- 2. The pipeline -------------------------------------- */}
        <Chapter
          number="02"
          title="How a verdict gets made"
          id="method"
          lede="Nine stages, in this order, every time. None of it is automatic: software and an AI reader help us cover more ground, but the score at the end and the sentence next to it are written by a person who can be argued with."
        >
          <ol className="border-t border-line">
            {STAGES.map((stage, i) => (
              <li
                key={stage.title}
                className="grid gap-x-8 gap-y-2 border-b border-line py-7 sm:grid-cols-[3rem_minmax(0,20rem)_minmax(0,1fr)]"
              >
                <span
                  className="tabular font-mono text-label-xs font-medium tracking-[0.14em] text-ink-faint"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-headline-sm text-ink">{stage.title}</h3>
                <p className="max-w-prose text-body-sm text-ink-muted">
                  {stage.body}
                  {"link" in stage ? (
                    <>
                      {" "}
                      <Link
                        href={stage.link.href}
                        className="text-brand underline decoration-brand-line underline-offset-4 transition-colors duration-fast hover:decoration-brand"
                      >
                        {stage.link.label}
                      </Link>
                      .
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ol>
        </Chapter>

        {/* --- 3. Worked example ------------------------------------ */}
        {example && criteria.length > 0 ? (
          <Chapter
            number="03"
            title="A real one, taken apart"
            id="example"
            lede="Not a diagram. This is a verdict currently published on the site, and every criterion behind its score."
          >
            {/* Held to a document column. At the full 1920px shell the
                criterion bars stretch into page-wide rules and stop reading
                as a chart — an exhibit should look like an exhibit. */}
            <div className="panel max-w-3xl overflow-hidden">
              {/* Head */}
              <div className="flex flex-wrap items-center justify-between gap-6 border-b border-line p-6 lg:p-8">
                <div className="min-w-0">
                  <span className="t-eyebrow">{example.brand.name}</span>
                  <h3 className="mt-1.5 text-headline-md text-ink">
                    <Link
                      href={productHref(example)}
                      className="transition-colors duration-fast hover:text-brand"
                    >
                      {example.title}
                    </Link>
                  </h3>
                </div>
                {example.score ? <ScoreRing score={example.score.overall} size="md" /> : null}
              </div>

              {/* Criteria — a bar chart made of the same hairlines the rest
                  of the page rules with, so it reads as evidence rather
                  than as a widget. */}
              <ul className="p-6 lg:p-8">
                {criteria.map((c) => (
                  <li key={c.key} className="py-3.5">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-body-sm text-ink">{c.label}</span>
                      <span className="tabular font-mono text-label-xs text-ink-muted">
                        {c.value.toFixed(1)}
                        <span className="text-ink-faint"> / 10</span>
                      </span>
                    </div>
                    <div className="mt-2 h-[2px] w-full bg-line">
                      <div
                        className="h-full bg-brand"
                        style={{ width: `${Math.min(Math.max(c.value, 0), 10) * 10}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>

              <p className="border-t border-line px-6 py-5 text-body-sm text-ink-muted lg:px-8">
                These criteria belong to{" "}
                <span className="text-ink">{example.category.name}</span>. A different category
                is judged on a different list — that is the point of the rubric, and it is why
                scores are comparable within a category and not across the whole site.
              </p>
            </div>
          </Chapter>
        ) : null}

        {/* --- 4. The boundary -------------------------------------- */}
        <Chapter number="04" title="Two numbers, kept apart" id="two-numbers">
          <div className="grid gap-x-14 gap-y-10 sm:grid-cols-2">
            <div className="border-t-2 border-brand pt-5">
              <p className="t-eyebrow mb-3 text-brand">The PickD Score</p>
              <p className="text-body-sm text-ink-muted">
                Ours. One number out of ten, built from the category rubric above, carrying the
                date it was last reviewed. It answers <span className="text-ink">how good is
                this</span>, and we are accountable for it.
              </p>
            </div>
            <div className="border-t-2 border-line-strong pt-5">
              <p className="t-eyebrow mb-3">The community rating</p>
              <p className="text-body-sm text-ink-muted">
                Yours. Stars from people who own the thing, shown with how many. It answers{" "}
                <span className="text-ink">what is it like to live with</span> — a question our
                rubric cannot reach.
              </p>
            </div>
          </div>
          <p className="mt-10 max-w-prose text-body-md text-ink-muted">
            They are never averaged together. A single blended figure would let a strong measured
            result bury a chorus of owners saying the hinge breaks, and it would let a review
            brigade overwrite a measurement. You get both, side by side, and you decide which one
            matters more for you.
          </p>
        </Chapter>

        {/* --- 5. Money --------------------------------------------- */}
        <Chapter number="05" title="How we pay for this" id="money">
          <p className="max-w-prose text-body-md text-ink-muted">
            When you follow a link to a retailer we may earn a commission, at no extra cost to
            you. That is the whole business model, and it is the reason the order of operations
            in <Link href="#commitments" className="text-brand underline decoration-brand-line underline-offset-4 transition-colors duration-fast hover:decoration-brand">§01</Link>{" "}
            is written down: the verdict is finished before anyone knows which retailer will
            carry the link, and the commission does not vary with what we conclude. We also do
            not sell products, run a basket, or hold stock — when you decide, you leave.
          </p>
          <p className="mt-6 max-w-prose text-body-md text-ink-muted">
            If you ever find a page that reads like it was written for a retailer rather than for
            you,{" "}
            <Link
              href="/contact"
              className="text-brand underline decoration-brand-line underline-offset-4 transition-colors duration-fast hover:decoration-brand"
            >
              tell us
            </Link>
            . That is a bug, and we treat it like one.
          </p>
        </Chapter>
      </div>

      <MethodSchema />
    </main>

  );
}

/**
 * Structured data for the methodology.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS PAGE, SPECIFICALLY
 *
 * The nine documents that go through <DocumentPage> all got typed together and
 * this one did not, because it is hand-built — it interleaves live product data
 * with the prose, so it could not share that component. It is also the single
 * most important page on the site to get typed, which makes the omission the
 * wrong way round.
 *
 * The homepage `Organization` declares `publishingPrinciples`, and this is the
 * document it points at. Until now that pointer resolved to an untyped page:
 * the claim "our principles are published" was made in structured data and
 * answered in prose. This is the other half of that assertion.
 *
 * `Article` rather than `WebPage` because this is an authored explanation with
 * a position, not reference material — and because `Article` is the type that
 * carries `dateModified` as a first-class expectation, which is the property
 * doing the actual work here. A methodology's credibility is a function of how
 * recently somebody stood behind it.
 *
 * `hasPart` exposes the five chapter anchors so an answer engine can cite
 * /how-we-research#money — "here is how they make money" — rather than the
 * document as a whole. Citing a specific clause is what a careful assistant
 * does, and it can only do it if the clauses have addresses.
 */
function MethodSchema() {
  const url = absoluteUrl("/how-we-research");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd({
          "@context": "https://schema.org",
          "@type": "Article",
          "@id": `${url}#document`,
          url,
          headline: "How we research",
          name: "How we research",
          description:
            "What goes into a PickD Score, what cannot buy its way in, and a worked example using a real verdict.",
          // See the UPDATED constant. Both dates are the same on purpose: the
          // method is revised in place, so the version in effect is the version
          // published, and inventing an original date we do not record would be
          // fabricating the more load-bearing of the two.
          datePublished: UPDATED,
          dateModified: UPDATED,
          inLanguage: "en-IN",
          isPartOf: { "@id": absoluteUrl("/#website") },
          author: { "@id": absoluteUrl("/#organization") },
          publisher: { "@id": absoluteUrl("/#organization") },
          about: { "@id": absoluteUrl("/#organization") },
          hasPart: CHAPTERS.map((chapter) => ({
            "@type": "WebPageElement",
            "@id": `${url}#${chapter.id}`,
            name: chapter.title,
            url: `${url}#${chapter.id}`,
          })),
        }),
      }}
    />
  );
}

/**
 * A numbered chapter. Same numbering grammar as the category index, so the two
 * editorial pages read as pages from one publication.
 */
function Chapter({
  number,
  title,
  id,
  lede,
  children,
}: {
  number: string;
  title: string;
  id: string;
  lede?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-section first:mt-0 scroll-mt-32">
      <div className="border-b border-line pb-5">
        <div className="flex items-baseline gap-4">
          <span
            className="tabular font-mono text-label-xs font-medium tracking-[0.14em] text-ink-faint"
            aria-hidden="true"
          >
            {number}
          </span>
          <h2 className="t-headline text-ink">{title}</h2>
        </div>
        {lede ? <p className="mt-4 max-w-prose text-body-md text-ink-muted sm:pl-[2.1rem]">{lede}</p> : null}
      </div>

      <div className="mt-9">{children}</div>
    </section>
  );
}
