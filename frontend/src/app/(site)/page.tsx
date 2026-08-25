import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getHomepage } from "@/lib/api";
import { PanelArriving, ProductGridArriving } from "@/components/ui/Arriving";
import { categoryHref } from "@/lib/format";
import type { HomepageSection } from "@/lib/types";
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
  const sections = await getHomepage();
  return sections.map((section) => <SectionRenderer key={section.id} section={section} />);
}

/**
 * Holds roughly the height of a hero plus one rail, so the research promise
 * and the footer do not ride up the page and then get pushed back down when
 * the sections land. Invisible for its first 420ms like every other fallback.
 */
function HomeArriving() {
  return (
    <div className="shell-wide py-16">
      <PanelArriving lines={3} className="max-w-2xl" />
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
          <SectionHeader title={section.title ?? "Browse categories"} subtitle={section.subtitle} href="/c" />
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
          />
          <div className="grid-products stagger mt-8">
            {(section.products ?? []).map((p, i) => (
              <ProductCard key={p.id} product={p} priority={i < 4} />
            ))}
          </div>
        </Section>
      );

    case "category_rail": {
      const slug = (section.data?.categorySlug as string) ?? "";
      return (
        <Section>
          <SectionHeader
            title={section.title ?? ""}
            subtitle={section.subtitle}
            href={slug ? `/c/electronics/${slug}` : undefined}
          />
          <div className="grid-products stagger mt-8">
            {(section.products ?? []).map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </Section>
      );
    }

    case "featured_brands":
      return (
        <Section>
          <SectionHeader title={section.title ?? "Brands"} subtitle={section.subtitle} href="/b" />
          {/* 160px + a 12px gap is 332px, four more than a 360px phone's
              content box — which is how a brand grid that looks fine on a
              laptop ends up one tile per row on the device most people use. */}
          <div className="grid-tiles stagger mt-8" style={{ "--tile-min": "160px" } as React.CSSProperties}>
            {(section.brands ?? [])
              .filter((b) => b.isPinned)
              .map((b) => (
                <Link
                  key={b.id}
                  href={`/b/${b.slug}`}
                  className="panel flex flex-col items-center justify-center gap-1.5 px-4 py-8
                             transition-colors duration-fast ease-ease hover:border-brand-line hover:bg-surface-1"
                >
                  <span className="font-display text-headline-sm font-bold tracking-[-0.02em] text-ink">
                    {b.name}
                  </span>
                  {b.productCount != null && (
                    <span className="tabular text-label-xs text-ink-faint">{b.productCount} products</span>
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
        <div className="max-w-2xl">
          <p className="t-eyebrow mb-3">Our method</p>
          <h2 className="t-headline text-ink">We're a research desk, not a store.</h2>
        </div>

        <ol className="mt-12 grid gap-8" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}>
          {steps.map((s) => (
            <li key={s.n} className="border-t border-line pt-6">
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
