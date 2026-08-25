import Link from "next/link";
import { jsonLd } from "@/lib/json-ld";
import { absoluteUrl } from "@/lib/site";

/** Breadcrumbs (spec §18, §47). Emits BreadcrumbList structured data alongside
 *  the visual trail so search engines get the hierarchy for free. */
export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 font-label text-label-xs uppercase tracking-[0.1em]">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`} className="flex items-center gap-2">
            {item.href ? (
              <Link href={item.href} className="text-ink-subtle transition-colors duration-fast hover:text-brand">
                {item.label}
              </Link>
            ) : (
              <span className="text-ink" aria-current="page">
                {item.label}
              </span>
            )}
            {i < items.length - 1 && (
              <span className="text-ink-faint" aria-hidden="true">
                /
              </span>
            )}
          </li>
        ))}
      </ol>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            /**
             * `item` must be an ABSOLUTE URL.
             *
             * This emitted the raw `href` — "/", "/c/electronics" — which is
             * what the <Link> needs and is not a valid `ListItem.item`. Google
             * requires a resolvable URL there and drops the whole breadcrumb
             * rich result when it cannot parse one, so the trail rendered
             * correctly for readers and silently did nothing for search on
             * every product and category page on the site.
             *
             * `metadataBase` fixes relative URLs in *metadata*; it has no
             * bearing on hand-written JSON-LD in the body, which is why this
             * has to resolve the origin itself.
             *
             * The final crumb has no href by design — it is the current page —
             * and a `ListItem` with a name and no `item` is explicitly valid as
             * the last element.
             */
            itemListElement: items.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.label,
              ...(item.href ? { item: absoluteUrl(item.href) } : {}),
            })),
          }),
        }}
      />
    </nav>
  );
}
