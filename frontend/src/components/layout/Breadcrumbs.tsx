import Link from "next/link";
import { jsonLd } from "@/lib/json-ld";

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
            itemListElement: items.map((item, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: item.label,
              ...(item.href ? { item: item.href } : {}),
            })),
          }),
        }}
      />
    </nav>
  );
}
