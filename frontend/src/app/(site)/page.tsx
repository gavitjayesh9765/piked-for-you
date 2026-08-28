import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getHomepage } from "@/lib/api";
import { PanelArriving, ProductGridArriving } from "@/components/ui/Arriving";
import { categoryHref } from "@/lib/format";
import type { HomepageSection, ProductSummary } from "@/lib/types";
import { jsonLd } from "@/lib/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, absoluteUrl } from "@/lib/site";

import { Section, SectionHeader } from "@/components/layout/Section";
import { Hero } from "@/components/home/Hero";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { Newsletter } from "@/components/home/Newsletter";
import { ProductCard } from "@/components/product/ProductCard";

/**
 * The homepage inherits its title and description from the root layout, which
 * already states them as the site defaults — repeating them here would create
 * two places to change one string.
 *
 * The canonical is the reason this export exists at all. Without it the page
 * declares no preferred URL, and `/`, `/?utm_source=newsletter` and any other
 * tagged variant are three separate documents as far as ranking is concerned.
 * Every share of the homepage that carries a campaign parameter currently
 * splits the signal for the site's most important URL.
 */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Homepage (spec §11).
 *
 * Composed entirely from admin-controlled sections (spec §39) — the order,
 * titles and contents come from the API, and this file only knows how to
 * *render* each section kind. Adding a rail is an admin action, not a deploy.
 */
export default function HomePage() {
  return (
    <>
      <main id="main">
        {/* The homepage is entirely admin-controlled, so nothing above this can
            be rendered without the API — but <ResearchPromise> below is our own
            fixed copy, and it is the one thing on this page that never needs to
            wait for anything. Keeping the page component synchronous puts it, and
            the whole shell around it, on screen immediately. */}
        <Suspense fallback={<HomeArriving />}>
          <Sections />
        </Suspense>
        <ResearchPromise />
      </main>
      <SiteStructuredData />
    </>
  );
}

/**
 * Site-level structured data (spec §47, §73).
 *
 * Two graphs, both deliberately on the homepage only. These describe the
 * *publisher*, not the page, and repeating them under every product would
 * assert the same three facts a thousand times over — Google reads them once,
 * from the site root, and duplication only adds weight to every response.
 *
 *   Organization — who is making these recommendations. This is what a brand
 *     knowledge panel is assembled from, and it is also the entity the `author`
 *     on every product Review already points at by name. Declaring it once here
 *     gives that name something to resolve to.
 *
 *   WebSite + SearchAction — the sitelinks search box. It tells Google that
 *     /search?q= is a real query endpoint, which lets a brand-name result carry
 *     a search field straight into our own results.
 *
 * Both are rendered through `jsonLd()` rather than `JSON.stringify` — see the
 * comment in lib/json-ld.ts for why that distinction is not cosmetic. Here the
 * values are all compile-time constants, so nothing is actually interpolated
 * from user input, but using the raw stringifier in one of three structured
 * data blocks is exactly how the unsafe one eventually gets copied.
 */
function SiteStructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: jsonLd([
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": absoluteUrl("/#organization"),
            name: SITE_NAME,
            url: absoluteUrl("/"),
            description: SITE_DESCRIPTION,
            slogan: SITE_TAGLINE,
            // The 512px cut in public/brand, not the old generated `/icon.png`
            // route — that file is gone. Google wants a real raster it can
            // fetch and crop for a knowledge panel, and it wants the DIMENSIONS
            // stated: an ImageObject with a bare `url` is accepted but not
            // preferred, and the dark-ink cut is the one to hand it, since the
            // panel is rendered on white.
            logo: {
              "@type": "ImageObject",
              url: absoluteUrl("/brand/icon-512.png"),
              width: 512,
              height: 512,
            },
            // The trust documents, declared as the organisation's stated
            // policies. An evaluator — human or algorithmic — assessing whether
            // these verdicts are independent is looking for exactly this.
            publishingPrinciples: absoluteUrl("/editorial-policy"),
            ethicsPolicy: absoluteUrl("/affiliate-disclosure"),
          },
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": absoluteUrl("/#website"),
            name: SITE_NAME,
            url: absoluteUrl("/"),
            description: SITE_DESCRIPTION,
            publisher: { "@id": absoluteUrl("/#organization") },
            inLanguage: "en-IN",
            potentialAction: {
              "@type": "SearchAction",
              target: {
                "@type": "EntryPoint",
                urlTemplate: absoluteUrl("/search?q={search_term_string}"),
              },
              // Schema.org requires this exact shape for the sitelinks search
              // box — the property name is a literal, not a placeholder we can
              // rename to something tidier.
              "query-input": "required name=search_term_string",
            },
          },
        ]),
      }}
    />
  );
}

async function Sections() {
  /**
   * A failed homepage read used to take the WHOLE page with it.
   *
   * `getHomepage()` throws an ApiError on any non-2xx — and, per the note on
   * TIMEOUT_MS in lib/api.ts, the first request after any quiet period on the
   * current hosting is expected to fail while the instance wakes. Thrown from
   * here it escaped the Suspense boundary, hit app/error.tsx, and replaced the
   * entire document with "We couldn't load this page."
   *
   * Two thirds of what that error page replaced did not need the API at all.
   * <Hero> takes no props and is fixed copy; so is <ResearchPromise> below it.
   * The reader lost the value proposition, the search field, the CTA and the
   * statement of method — every durable thing on the site — because a rail of
   * product cards was slow.
   *
   * Caught here, the outage costs exactly what is actually missing: the
   * admin-curated sections. Everything else renders, and the page is still a
   * page. The reload link is a plain anchor rather than a router push on
   * purpose — the point is to re-issue the request, not to re-render a tree
   * built from the same failed one.
   */
  let sections: HomepageSection[];
  try {
    sections = await getHomepage();
  } catch {
    return <SectionsUnavailable />;
  }
  return sections.map((section) => <SectionRenderer key={section.id} section={section} />);
}

/** The homepage minus the parts that need a working API. */
function SectionsUnavailable() {
  return (
    <>
      <Hero />
      <Section>
        <div className="panel reveal flex flex-col items-start gap-4 p-8 sm:p-10">
          <p className="t-eyebrow">Picks unavailable</p>
          <h2 className="text-headline-md text-ink">Our shortlists aren&rsquo;t loading right now.</h2>
          {/* Deliberately does NOT send the reader anywhere else in the
              catalogue. The first draft offered "Browse categories" beside the
              retry — and the category bar, the /c index and every rail all read
              through the same API this notice exists to report as down, so the
              alternative would have handed them a second error page. Nothing is
              promised here except that the picks are missing and that trying
              again is worth doing.

              A plain <a>, not a <Link>: the point is to re-issue the request,
              not to re-render a tree from the same failed response. */}
          <p className="max-w-prose text-body-md text-ink-muted">
            This is usually our research service waking up, and it normally passes within a
            minute. Nothing has been lost — the verdicts are all still published.
          </p>
          <a
            href="/"
            className="press mt-2 inline-flex h-11 items-center justify-center rounded-full bg-brand-fill
                       px-6 font-label text-label font-semibold uppercase tracking-[0.06em]
                       text-brand-on shadow-brand hover:brightness-110"
          >
            Try again
          </a>
        </div>
      </Section>
    </>
  );
}

/**
 * Holds roughly the height of a hero plus one rail, so the research promise
 * and the footer do not ride up the page and then get pushed back down when
 * the sections land. Invisible for its first 420ms like every other fallback.
 */
function HomeArriving() {
  return (
    <div className="shell-wide py-16">
      {/* Sized against the hero it stands in for. The fallback used to hold a
          three-line block and a card row — a few hundred pixels where the real
          sections are a viewport-height hero plus a rail, so the research
          promise and the footer sat near the top of the window and were then
          shoved a full screen down the moment the API answered. Reserving the
          same cap the hero uses means the page below this does not move when
          the content lands. */}
      <div className="flex min-h-[calc(100svh-var(--nav-h)-var(--subnav-h)-8rem)] flex-col justify-center">
        <PanelArriving lines={3} className="max-w-2xl" />
      </div>
      <div className="mt-16">
        <ProductGridArriving count={4} />
      </div>
    </div>
  );
}

function SectionRenderer({ section }: { section: HomepageSection }) {
  switch (section.kind) {
    case "hero":
      return <Hero />;

    case "category_tiles":
      return (
        <Section>
          <SectionHeader
            title={section.title ?? "Browse categories"}
            subtitle={section.subtitle}
            href="/c"
            className="reveal rule-accent"
          />
          <div className="mt-8">
            <CategoryTiles categories={section.categories ?? []} />
          </div>
        </Section>
      );

    case "top_picks":
      return (
        <Section>
          <SectionHeader
            eyebrow="Curated by our editors"
            title={section.title ?? "Top Picks"}
            subtitle={section.subtitle}
            href="/top-picks"
            className="reveal rule-accent"
          />
          <div className="grid-products stagger reveal-group mt-8">
            {(section.products ?? []).map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </Section>
      );

    case "category_rail": {
      const products = section.products ?? [];
      // An empty rail renders NOTHING, not an empty rail.
      //
      // Until now a category_rail whose category had no published products
      // still drew its title, its subtitle and its "View all" link over an
      // empty grid — today that is the Gaming rail, two hundred pixels of
      // heading promising products that are not there, sitting between two
      // rails that do have them. The section is admin-composed and the admin
      // may well have added it ahead of the research, which is the right way
      // round; the page just should not advertise the gap. It reappears by
      // itself the moment something is published under that category.
      //
      // Deliberately not a "nothing here yet" empty state: the reader did not
      // ask for this category, the homepage offered it. Feedback about an
      // empty rail belongs in the composer, where someone can act on it.
      if (products.length === 0) return null;

      return (
        <Section>
          <SectionHeader
            title={section.title ?? ""}
            subtitle={section.subtitle}
            href={railHref(section, products)}
            className="reveal rule-accent"
          />
          <div className="grid-products stagger reveal-group mt-8">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      );
    }

    case "featured_brands":
      return (
        <Section>
          <SectionHeader
            title={section.title ?? "Brands"}
            subtitle={section.subtitle}
            href="/b"
            className="reveal rule-accent"
          />
          {/* Three per row on a phone, like the category strip above it — ten
              pinned brands at two-up is five rows of very large tiles holding
              one word each, and the two sections reading as one system matters
              more here than either does alone. A brand tile is a wordmark, so
              the display face steps down rather than the tile growing: "Cosmic
              Byte" and "Sennheiser" both have to sit inside a 111px track. */}
          <div
            className="grid-tiles stagger reveal-group mt-8"
            style={{ "--tile-min": "160px", "--tile-cols": "3" } as React.CSSProperties}
          >
            {(section.brands ?? [])
              .filter((b) => b.isPinned)
              .map((b) => (
                <Link
                  key={b.id}
                  href={`/b/${b.slug}`}
                  className="panel panel-raise tile-sweep group flex flex-col items-center justify-center
                             gap-1.5 px-2 py-6 hover:border-brand-line sm:px-4 sm:py-8"
                >
                  <span
                    className="text-balance text-center font-display text-body-md font-bold leading-tight
                               tracking-[-0.02em] text-ink transition-colors duration-fast
                               group-hover:text-brand sm:text-headline-sm"
                  >
                    {b.name}
                  </span>
                  {b.productCount != null && (
                    <span className="tabular whitespace-nowrap text-label-xs tracking-[0.02em] text-ink-faint sm:tracking-[0.14em]">
                      {b.productCount > 0 ? `${b.productCount} researched` : "—"}
                    </span>
                  )}
                </Link>
              ))}
          </div>
        </Section>
      );

    case "newsletter":
      return <Newsletter />;

    default:
      return null;
  }
}

/**
 * Where a category rail's "View all" goes.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS REPLACED
 *
 * `/c/electronics/${slug}` — the root segment written out by hand. It resolves
 * today only because every category in the taxonomy happens to sit under
 * Electronics, and it is wrong in two ways that will not announce themselves:
 *
 *   - A SECOND ROOT breaks every rail under it at once. The sub-nav in
 *     SiteHeader is built to promote itself to the roots the moment there is
 *     more than one; this line would keep filing a Home & Kitchen rail under
 *     Electronics and 404.
 *
 *   - A DEEPER RAIL breaks on its own. A rail for Headphones — a leaf at
 *     `electronics/audio/headphones` — links to `/c/electronics/headphones`,
 *     which is not a path in the tree. The route matches `[...path]`, so
 *     nothing errors; the reader simply lands on a not-found page from a
 *     "View all" that looked fine in the admin panel.
 *
 * The rail's own products carry the answer. `ProductSummary.category` is the
 * product's LEAF category with its full ancestor `path`, so the section's slug
 * can be located inside a real path and the href built from the segments above
 * and including it — by `categoryHref`, the same function every other category
 * link on the site goes through.
 *
 * A rail with no products, or one whose slug appears in none of them, gets no
 * link rather than a guessed one. An absent "View all" is a smaller failure
 * than a "View all" that leads nowhere.
 */
function railHref(section: HomepageSection, products: ProductSummary[]): string | undefined {
  const slug = (section.data?.categorySlug as string) ?? "";
  if (!slug) return undefined;

  for (const product of products) {
    const path = product.category.path?.length ? product.category.path : [product.category.slug];
    const depth = path.indexOf(slug);
    if (depth !== -1) {
      return categoryHref({ slug, path: path.slice(0, depth + 1) });
    }
  }

  return undefined;
}

/**
 * Closing statement of intent. This is the trust surface required by spec §59 —
 * it says plainly what we do, what we don't do, and how we make money.
 */
function ResearchPromise() {
  const steps = [
    { n: "01", title: "We shortlist", body: "Every category starts by cutting hundreds of listings down to the handful that are genuinely worth considering." },
    { n: "02", title: "We test what matters", body: "Category-specific criteria, scored consistently — so a comparison actually compares." },
    { n: "03", title: "We write a verdict", body: "Who it's for, who should skip it, and what we'd buy instead. Written before any retailer link is attached." },
    { n: "04", title: "You choose", body: "We don't sell anything. When you've decided, we hand you off to Amazon or Flipkart and get out of the way." },
  ];

  return (
    <section className="mt-section border-y border-line bg-surface-1">
      <div className="shell-wide py-20">
        <div className="reveal max-w-2xl">
          <p className="t-eyebrow mb-3">Our method</p>
          <h2 className="t-headline text-ink">We're a research desk, not a store.</h2>
        </div>

        {/* Each step's rule draws itself as the step arrives, left to right —
            the four numbered lines reading as a sequence being set down rather
            than four boxes fading up together. */}
        <ol
          className="reveal-group mt-12 grid gap-8"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}
        >
          {steps.map((s) => (
            <li key={s.n} className="rule-draw pt-6">
              <span className="tabular text-label font-semibold text-brand">{s.n}</span>
              <h3 className="mt-3 text-headline-sm text-ink">{s.title}</h3>
              <p className="mt-2 text-body-sm text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
