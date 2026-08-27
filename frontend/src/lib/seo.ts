import type { Brand, Category } from "./types";

/**
 * Title and description copy for the pages that are generated from data.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A MODULE AND NOT INLINE STRINGS IN `generateMetadata`
 *
 * Three route files were each building their own titles, and each had drifted
 * to a slightly different formula. That is survivable while there are three.
 * It stops being survivable the moment anyone wants to answer "what do our
 * category titles look like?" — the answer was "open three files and read the
 * template literals", and any change had to be made in all of them or the
 * catalogue ends up with two title conventions in the same sitemap.
 *
 * More practically: these strings have a HARD BUDGET (see below) and the budget
 * is only checkable in one place. A limit enforced by comments in three files
 * is a limit nobody enforces.
 */

/**
 * How many characters the root layout's title template spends before the page
 * gets any: `%s · SortedChoice` is the separator plus the site name.
 *
 * This is why a page title of "60 characters, the recommended maximum" is
 * wrong by fifteen — the page is not the last thing in the `<title>`.
 */
const TITLE_SUFFIX = " · SortedChoice".length; // 15

/**
 * The budget a generated page title has to fit inside.
 *
 * 60 is the number every SEO tool checks against, and it is a proxy for the
 * real constraint: Google renders a desktop title to roughly 580px and cuts
 * whatever does not fit. Long category names will still blow through this —
 * "Over-Ear Noise Cancelling Headphones" is 36 characters before we add a word
 * to it — and that is accepted rather than solved. Truncating a category's own
 * name to hit a character count produces "Best Over-Ear Noise Cancelling Head…",
 * which is worse in every way than a title Google truncates itself.
 *
 * What the budget IS for is stopping us adding decoration. Every extra word in
 * a template costs the same characters on every page in the catalogue, and the
 * check below is what makes that cost visible in development.
 */
const TITLE_BUDGET = 60 - TITLE_SUFFIX; // 45

/** Google truncates a description around 155–160 characters. */
const DESCRIPTION_BUDGET = 155;

/**
 * Warn in development when a generated string overruns its budget.
 *
 * Deliberately a warning and not a throw: an over-long title is a page that
 * ranks slightly worse, not a page that should refuse to render. Silent in
 * production — this is a message for whoever is editing the templates, and a
 * long category name is not something a production log can act on.
 */
function budgeted(value: string, budget: number, label: string): string {
  if (process.env.NODE_ENV === "development" && value.length > budget) {
    console.warn(
      `[seo] ${label} is ${value.length} chars, over the ${budget} budget: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * True when this category is a HUB — a shelf that holds other categories —
 * rather than a LEAF that holds products.
 *
 * The distinction decides whether "Best" belongs in the title, and it matters
 * more than it looks. "Best Wireless Earbuds" is the exact phrase people type.
 * "Best Electronics" is a phrase nobody has ever typed, reads as spam, and
 * makes a promise the page does not keep — /c/electronics is a directory of
 * sub-categories, not a ranking of products.
 *
 * ---------------------------------------------------------------------------
 * ⚠ WHY THIS DOES NOT LOOK AT `category.children`, WHICH IS THE OBVIOUS FIELD
 *
 * Because it is always empty. The public categories endpoint returns a FLAT
 * list carrying `parentId`, and `Category.children` is populated by nobody —
 * app/(site)/c/page.tsx says so in as many words above its own `buildTree`,
 * and the live response has no `children` key at all.
 *
 * A first cut of this function tested `children?.length` and was silently
 * useless: it fell through to the depth check on every call, and /c/electronics
 * /audio — a shelf holding headphones, earbuds, speakers and soundbars —
 * shipped as "Best Audio". Which is how it was caught, and why the fallback is
 * now the unreliable path rather than the only one.
 *
 * ---------------------------------------------------------------------------
 * THE TWO SIGNALS
 *
 * Given the full category list, a hub is a category that some other ACTIVE
 * category names as its parent. That is exact, and it is cheap — the list is
 * one already-memoized fetch that the site chrome makes on every request
 * anyway, so asking for it here costs nothing.
 *
 * Without the list, depth is the fallback: a root-level category is a hub far
 * more often than not. When the two disagree, treating a leaf as a hub costs
 * one keyword; treating a hub as a leaf ships a title that lies.
 */
function isHub(category: Category, all?: Category[]): boolean {
  if (all?.length) {
    return all.some((c) => c.isActive && c.parentId === category.id);
  }
  return (category.path?.length ?? 1) <= 1;
}

/**
 * `<title>` for a category page.
 *
 * ---------------------------------------------------------------------------
 * WHY "BEST" IS IN HERE, HAVING NOT BEEN BEFORE
 *
 * These pages used to be titled "{Category} — researched and ranked". That is
 * good copy and it was costing real traffic, because it omits the single word
 * the entire query class is built around.
 *
 * A category page answers "what should I buy?" — commercially the most
 * valuable question on the site, and the one people ask by typing "best
 * wireless earbuds". A title that never contains "best" is competing for that
 * query on inference alone against a page whose title matches it exactly.
 *
 * It is also not an overclaim, which is the test that matters here. The page
 * IS an editorially ordered ranking — it already says so in its own `ItemList`
 * markup, and `itemListOrder` has asserted that this ordering is meaningful
 * since long before this change. Putting the same claim in the title is making
 * the page's existing promise legible, not inventing a new one.
 *
 * "researched and ranked" moves to the description, where it has room and
 * where it does the job it was always doing: distinguishing us from the
 * affiliate listicles that will be ranking alongside us for the same phrase.
 */
export function categoryTitle(category: Category, all?: Category[]): string {
  const title = isHub(category, all)
    ? // A hub is a directory. "buying guides" is what it actually contains and
      // is itself a searched phrase, where "Best Electronics" is neither.
      `${category.name} buying guides`
    : `Best ${category.name}`;

  return budgeted(title, TITLE_BUDGET, `category title for "${category.name}"`);
}

/**
 * `<meta name="description">` for a category page.
 *
 * The editor's own description always wins — it is the one written with
 * knowledge of what is actually in the category, and overriding authored copy
 * with a template would be a strange thing for a CMS-driven site to do.
 *
 * The generated fallback exists because the alternative in production is a
 * category with no description at all, and Google then invents one by scraping
 * whatever text is nearest the top of the page. The product count is included
 * where the API supplies it because a specific number is the most persuasive
 * thing we can say in a snippet — "24 products scored" is a claim about work
 * done, and every competitor for the phrase is saying "top 10 picks for 2026".
 */
export function categoryDescription(category: Category, all?: Category[]): string {
  if (category.description) return category.description;

  const count = category.productCount;
  const scope =
    count && count > 0
      ? `${count} products scored against a fixed rubric`
      : "Every option scored against a fixed rubric";

  const description = isHub(category, all)
    ? `Independent buying guides across ${category.name}. ${scope}, with our verdict on each — researched, ranked, and never sponsored.`
    : `The best ${category.name}, researched and ranked. ${scope}, with an independent verdict on each. We sell nothing and take no sponsorship.`;

  return budgeted(description, DESCRIPTION_BUDGET, `category description for "${category.name}"`);
}

/** `<title>` for a brand page. */
export function brandTitle(brand: Brand): string {
  return budgeted(
    `${brand.name} products, reviewed`,
    TITLE_BUDGET,
    `brand title for "${brand.name}"`,
  );
}

/**
 * `<meta name="description">` for a brand page.
 *
 * Note what this deliberately does NOT say: nothing about the brand itself.
 * A generated sentence praising or characterising a manufacturer would be a
 * claim we have not researched, on a page whose whole value is that our claims
 * are researched — and it would be the same sentence on every brand page,
 * which is the definition of the boilerplate Google discounts. The description
 * describes OUR coverage, which is the thing we actually know.
 */
export function brandDescription(brand: Brand): string {
  if (brand.description) return brand.description;

  const count = brand.productCount;

  /**
   * The whole sentence varies, not just its subject.
   *
   * A brand with exactly ONE researched product is the common case on a young
   * catalogue, not an edge case, so the singular has to read properly rather
   * than merely avoid saying "1 products". The first cut of this got half way
   * — it fixed the count and left the tail, producing "The one Sony product we
   * have researched so far, EACH with a score" — which is the kind of sentence
   * that tells a reader a machine wrote it, on a page whose entire pitch is
   * that a person did the work.
   */
  const coverage =
    !count || count <= 0
      ? `Every ${brand.name} product we have researched, with a score, a verdict and current prices.`
      : count === 1
        ? `The one ${brand.name} product we have researched so far, with its score, our verdict and current prices.`
        : `All ${count} ${brand.name} products we have researched, each with a score, a verdict and current prices.`;

  return budgeted(
    `${coverage} Independent reviews — we sell nothing and take no sponsorship.`,
    DESCRIPTION_BUDGET,
    `brand description for "${brand.name}"`,
  );
}
