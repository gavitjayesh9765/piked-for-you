import type { ReactNode } from "react";

/**
 * The guides — long-form explainers that sit upstream of the catalogue.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS CONTENT TYPE EXISTS AT ALL, GIVEN WE ALREADY HAVE CATEGORY PAGES
 *
 * A category page answers "which one should I buy". It is the commercially
 * valuable question and it is also the LAST question a buyer asks. Before it
 * they ask a different one, and they ask it far more often:
 *
 *     "is Snapdragon better than Dimensity"
 *     "what does the H mean in i7-13700H"
 *     "can a 4060 run 1440p"
 *
 * Those queries have no product in them, so no product page will ever rank for
 * them, and a category page that tried would be keyword-stuffing its own
 * description. They are answered by an explainer or they are answered by
 * somebody else — and whoever answers them gets the reader one step before the
 * purchase decision, which is the step where the decision is actually made.
 *
 * So a guide is not a blog post in the "company news" sense and this type is
 * deliberately hostile to that use. There is no `tags`, no `category`, no
 * author bio block, and no excerpt separate from the description. Every field
 * below either lands in structured data or steers a reader into the catalogue.
 *
 * ---------------------------------------------------------------------------
 * WHY POSTS ARE .tsx MODULES AND NOT MDX OR ROWS IN A TABLE
 *
 * MDX was the obvious choice and was rejected on two counts. It adds a build
 * plugin to a Next config that currently has none, and — the deciding one —
 * these articles are built around interactive charts whose data has to
 * typecheck against the chart's props. In MDX the data would be untyped
 * frontmatter or an import that MDX cannot verify; here `tsc --noEmit` fails
 * the build when a benchmark table and the component that renders it disagree.
 *
 * A database table was rejected for a different reason: the admin panel has no
 * editor that could author a chart, so authoring would happen in a text field
 * with JSX in it, which is the worst of both.
 *
 * The cost is that publishing a guide is a deploy rather than a CMS action —
 * the opposite trade to products (spec §73). That is accepted. We will publish
 * a handful of these a year, each one is a week of work, and none of them is
 * time-sensitive the way a price is.
 */

/** A numbered chapter within a guide. Its `id` is a permanent anchor. */
export type GuideSection = {
  /**
   * Anchor id, and half of the deep link an answer engine will cite.
   *
   * ⚠ TREAT THESE AS PUBLIC URLS. They are emitted into `hasPart` structured
   * data, which is precisely an invitation to link to
   * /guides/<slug>#<id> — so renaming one silently breaks an inbound
   * link we asked for. Add a section rather than repurposing an id.
   */
  id: string;
  title: string;
  body: ReactNode;
};

/** A question and its answer, rendered on the page and emitted as `FAQPage`. */
export type GuideFaq = {
  question: string;
  /** The same node the page renders — never a second copy. See FaqJsonLd. */
  answer: ReactNode;
};

/**
 * A pointer from the article into the catalogue.
 *
 * ---------------------------------------------------------------------------
 * WHY THE HREF IS A SLUG PATH AND NOT A CATEGORY ID
 *
 * An id would be correct and would require a live API call to render a link,
 * which would make an otherwise static article depend on an upstream that
 * `getCategoriesForChrome` already treats as allowed to be down. A guide that
 * renders without its internal links is a guide with no commercial purpose.
 *
 * The path is stable because these are seeded taxonomy roots, not editor
 * inventions — see supabase/migrations/*_category_tree_seed.sql.
 *
 * It is nonetheless checked at RENDER time, in development only, against the
 * live taxonomy: components/guides/NextRail.tsx warns to the console when a
 * guide points at a path the API does not have. That catches the real failure
 * mode — somebody renames a category in the admin panel months from now — at
 * the cost of nothing in production, where the hard-coded link still renders
 * and a stale link is a far better outcome than a linkless article.
 */
export type GuideLink = {
  /** Site-relative path, e.g. "/c/electronics/mobiles/smartphones". */
  href: string;
  /** The link text. Write it as a phrase a reader would click, not a slug. */
  label: string;
  /** One line on what is behind the link. Shown under the label in the rail. */
  note: string;
};

export type Guide = {
  /** URL slug. `/guides/<slug>`. Permanent once published. */
  slug: string;

  /**
   * `<title>`, before the ` · SortedChoice` template is applied.
   *
   * ⚠ 45 CHARACTERS is the budget — see lib/seo.ts for where that number comes
   * from. These titles will overrun it and that is accepted here in a way it is
   * not for a category: a guide title has to contain the comparison people
   * type ("Snapdragon vs Dimensity") or it cannot match the query at all, and a
   * matched-but-truncated title beats a short one that matches nothing.
   */
  title: string;

  /** The `<h1>`. May be longer and warmer than `title`. */
  heading: string;

  /** `<meta name="description">`. Budget 155 characters. */
  description: string;

  /** The standfirst under the h1. Two sentences at most. */
  dek: string;

  /** Small tracked label above the h1 — the series this guide belongs to. */
  eyebrow: string;

  /** ISO date. First publication. */
  published: string;

  /**
   * ISO date of the last substantive revision.
   *
   * This is the field that decides whether the article is believed. Every
   * guide here is about hardware generations, and hardware generations move —
   * an explainer of phone chips that has not been touched in eighteen months is
   * wrong about the top of its own chart. Bump it when the DATA changes, not
   * when a typo is fixed: an always-fresh date is the signal Google learns to
   * discount, exactly as with sitemap `lastmod`.
   */
  updated: string;

  /**
   * The answer, stated flatly, in one or two sentences.
   *
   * ---------------------------------------------------------------------------
   * THIS FIELD IS THE ENTIRE ANSWER-ENGINE STRATEGY IN ONE STRING.
   *
   * An assistant asked "is Snapdragon or Dimensity better" reads the page and
   * needs a span it can quote. Given prose it will synthesise one, and the
   * synthesis is where our hedges, our caveats and our reasoning get lost. Given
   * a short declarative paragraph in a visually distinct block near the top, it
   * quotes that instead — because it is the highest-confidence extractive span
   * on the page.
   *
   * So this is written to be lifted verbatim and to survive being lifted: it
   * has to be true with no surrounding context, contain no "as we saw above",
   * and hedge in the sentence rather than in the next paragraph.
   */
  answer: string;

  /**
   * Three to five scannable claims, each one a complete thought.
   *
   * Rendered as the takeaways panel and used for nothing else. Not structured
   * data — `ItemList` of loose assertions with no items behind them is the kind
   * of markup that gets a site's structured data ignored wholesale.
   */
  takeaways: string[];

  /** Numbered chapters, in reading order. */
  sections: GuideSection[];

  /** Questions people actually ask, answered on the page and in `FAQPage`. */
  faqs: GuideFaq[];

  /**
   * Where a reader goes next — the catalogue links this article exists to feed.
   *
   * Required, and required to be non-empty, because a guide with no route into
   * the catalogue is a page that costs us crawl budget and returns nothing.
   */
  next: GuideLink[];

  /**
   * Slugs of the other guides in this cluster.
   *
   * ---------------------------------------------------------------------------
   * WHY THIS IS EXPLICIT RATHER THAN "SHOW THREE RECENT GUIDES"
   *
   * These three articles are a deliberate topic cluster — phone silicon, laptop
   * silicon, graphics silicon — and the internal links between them are the
   * mechanism by which a cluster outranks three unconnected pages on the same
   * subjects. "Recent posts" is a widget; a named cluster is a claim about
   * topical coverage, and it is the claim that does the work.
   */
  related: string[];

  /**
   * Entities the article is genuinely ABOUT, for `about` / `mentions`.
   *
   * ⚠ Only things discussed at length. `mentions` is a claim that the page has
   * something to say about the entity, and stuffing it with every brand name
   * that appears once is how the whole graph stops being trusted.
   */
  entities: {
    /** Brand slugs on this site, e.g. "apple". Linked and typed as `Brand`. */
    brands: string[];
    /** Category paths on this site, for `about`. */
    categories: string[];
  };
};
