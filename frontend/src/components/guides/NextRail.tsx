import Link from "next/link";

import type { GuideLink } from "@/content/guides/types";
import { getCategoriesForChrome } from "@/lib/api";
import { categoryHref } from "@/lib/format";
import type { Category } from "@/lib/types";

/**
 * The rail that turns a reader into a visit to the catalogue.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS THE MOST IMPORTANT COMPONENT IN THE GUIDES
 *
 * An explainer that ranks for "snapdragon vs dimensity" and sends nobody
 * anywhere is a cost centre. It burns crawl budget, it dilutes the site's
 * topical focus away from "what should I buy", and it earns nothing. The
 * article's job is to answer the question honestly and then say, plainly, that
 * we have already done the next piece of work for you.
 *
 * The links are therefore written as an EDITORIAL handoff rather than a
 * "related categories" widget: each one carries a sentence explaining what is
 * behind it, because "Smartphones →" is a navigation element and "the phones
 * we would actually buy at each price, with the chip named on every card" is a
 * reason to click.
 *
 * ---------------------------------------------------------------------------
 * WHY THE HREFS ARE HARD-CODED AND ONLY *CHECKED* AGAINST THE API
 *
 * Resolving these from the live taxonomy would guarantee they never 404 and
 * would make the whole rail disappear whenever the API is slow or down — which
 * `getCategoriesForChrome` explicitly permits, by design, for exactly the pages
 * that should not fail because a category list was unavailable.
 *
 * For a policy page an empty nav rail is a smaller page. Here it is the entire
 * commercial point of the article, silently missing, on the render that a
 * crawler happened to take. So the links are static and always render, and the
 * live list is used only to WARN, in development, when one of them has drifted.
 * A stale link that goes to a real page beats a correct link that is absent.
 */

/** Every active category path on the site, as "/c/a/b/c" strings. */
function pathsOf(categories: Category[]): Set<string> {
  const out = new Set<string>();
  const walk = (nodes: Category[]) => {
    for (const node of nodes) {
      if (node.isActive) out.add(categoryHref(node));
      if (node.children?.length) walk(node.children);
    }
  };
  walk(categories);
  return out;
}

/**
 * Warn when a guide points somewhere the taxonomy no longer has.
 *
 * Development only, and deliberately not an exception. The failure this catches
 * is "somebody renamed Smartphones in the admin panel eight months from now",
 * which is a content problem discovered by whoever next runs the site locally —
 * not a reason to take a production page down, and not something a production
 * log could act on anyway. Same argument as the title-length check in lib/seo.ts.
 */
async function warnOnDrift(links: GuideLink[]): Promise<void> {
  if (process.env.NODE_ENV !== "development") return;

  const categories = await getCategoriesForChrome();
  if (categories.length === 0) return; // API down locally — nothing to check against.

  const known = pathsOf(categories);
  for (const link of links) {
    // Brand links are not in the category tree; they are checked by their own
    // page 404ing, which is loud enough in development.
    if (!link.href.startsWith("/c/")) continue;
    if (!known.has(link.href)) {
      console.warn(
        `[guides] "${link.label}" points at ${link.href}, which is not an active ` +
          `category. Either the category was renamed or the guide is wrong.`,
      );
    }
  }
}

export async function NextRail({ links }: { links: GuideLink[] }) {
  await warnOnDrift(links);

  if (links.length === 0) return null;

  return (
    <section className="mt-16 rounded-lg border border-brand-line bg-brand-soft/30 px-6 py-7 sm:px-8">
      <p className="t-eyebrow mb-2">Now the buying part</p>
      <h2 className="text-headline-sm text-ink">
        We have already ranked what this guide describes
      </h2>
      <p className="mt-3 max-w-2xl text-body-md text-ink-muted">
        Every product below is scored against a rubric fixed before testing, and the chip
        or card inside it is listed on the spec sheet — so you can apply everything above
        without opening a second tab.
      </p>

      <ul className="mt-7 grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="group flex h-full flex-col rounded-md border border-line bg-surface-0 px-5 py-4
                         transition-all duration-fast hover:border-brand hover:shadow-e1"
            >
              <span className="flex items-baseline gap-2 text-body-md font-medium text-ink transition-colors duration-fast group-hover:text-brand">
                {link.label}
                <span
                  aria-hidden="true"
                  className="translate-x-0 transition-transform duration-fast group-hover:translate-x-1"
                >
                  &rarr;
                </span>
              </span>
              <span className="mt-1.5 text-body-sm text-ink-subtle">{link.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
