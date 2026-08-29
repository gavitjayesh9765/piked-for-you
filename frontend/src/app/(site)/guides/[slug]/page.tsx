import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GUIDES, getGuide } from "@/content/guides";
import { absoluteUrl } from "@/lib/site";
import { GuideArticle } from "@/components/guides/GuideArticle";

/**
 * A single guide.
 *
 * ---------------------------------------------------------------------------
 * ⚠ THESE RENDER DYNAMICALLY, AND NOT BECAUSE OF ANYTHING ON THIS PAGE.
 *
 * The content is a TypeScript module — there is no upstream call, nothing to
 * revalidate, and nothing that can go stale between deploys, because the one
 * thing that WOULD go stale (the benchmark data) is versioned in the repository
 * precisely so that changing it is a reviewed commit rather than a quiet edit.
 * By rights this should prerender to a file.
 *
 * It does not, and `next build` reports every route in this application as `ƒ`
 * for the same reason: app/layout.tsx awaits `headers()` to read the CSP nonce,
 * and a dynamic API in the root layout opts the entire tree out of static
 * generation. That is a deliberate trade made there — the nonce is what allows
 * a strict `script-src` with no `'unsafe-inline'` — and it is not this route's
 * to reverse.
 *
 * Worth knowing anyway, because the practical properties are still good: these
 * pages touch no database and no API, so they render in microseconds and cannot
 * fail because an upstream was slow. Do not "fix" this by adding
 * `dynamic = "force-static"`; it would conflict with the root layout and fail
 * the build rather than making anything faster.
 *
 * `generateStaticParams` below is therefore NOT doing prerendering work here.
 * It earns its place through `dynamicParams` — see the note on that export.
 */

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

/**
 * Anything not in the registry is a 404, not a render.
 *
 * Without this, an unknown slug would be rendered on demand and — since
 * `getGuide` returns undefined and the component would throw — served as a 500.
 * A 500 on a URL that has never existed teaches a crawler the site is broken
 * rather than that the page is not there.
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) return {};

  const url = `/guides/${guide.slug}`;

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: url },

    /**
     * `article` rather than the site default `website`.
     *
     * This is what puts published and modified times into the Open Graph payload,
     * and those are read well beyond Facebook — several answer-engine crawlers
     * and every link unfurler take dates from OG before they parse JSON-LD,
     * because OG is cheap and always in the head.
     *
     * The `authors` entry is an ABSOLUTE url to /about rather than a person's
     * name, matching the `author: { "@id": … /#organization }` used in the
     * JSON-LD and on every other authored surface here. One author entity, three
     * representations.
     *
     * ⚠ It has to be absolute. Next emits this value verbatim into
     * `<meta property="article:author">` — unlike `openGraph.url`, it is NOT
     * resolved against `metadataBase` — so a relative "/about" would ship a
     * meta tag pointing at a path with no origin, which every consumer reads as
     * either a broken URL or an author literally named "/about".
     */
    openGraph: {
      type: "article",
      url,
      title: guide.heading,
      description: guide.description,
      publishedTime: guide.published,
      modifiedTime: guide.updated,
      authors: [absoluteUrl("/about")],
    },
    twitter: {
      card: "summary_large_image",
      title: guide.heading,
      description: guide.description,
    },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) notFound();

  return <GuideArticle guide={guide} all={GUIDES} />;
}
