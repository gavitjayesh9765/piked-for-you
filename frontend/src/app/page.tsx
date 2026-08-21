import Link from "next/link";
import { getCategories, getHomepage } from "@/lib/api";
import { categoryHref } from "@/lib/format";
import type { HomepageSection } from "@/lib/types";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Section, SectionHeader } from "@/components/layout/Section";
import { Hero } from "@/components/home/Hero";
import { CategoryTiles } from "@/components/home/CategoryTiles";
import { Newsletter } from "@/components/home/Newsletter";
import { ProductCard } from "@/components/product/ProductCard";

/**
 * Homepage (spec §11).
 *
 * Composed entirely from admin-controlled sections (spec §39) — the order,
 * titles and contents come from the API, and this file only knows how to
 * *render* each section kind. Adding a rail is an admin action, not a deploy.
 */
export default async function HomePage() {
  const [sections, categories] = await Promise.all([getHomepage(), getCategories()]);

  return (
    <>
      <SiteHeader categories={categories} />
      <main id="main">
        {sections.map((section) => (
          <SectionRenderer key={section.id} section={section} />
        ))}
        <ResearchPromise />
      </main>
      <SiteFooter />
    </>
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
          <div className="grid-products mt-8">
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
          <div className="grid-products mt-8">
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
          <div
            className="mt-8 grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))" }}
          >
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
