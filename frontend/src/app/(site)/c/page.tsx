import type { Metadata } from "next";
import Link from "next/link";

import { Suspense } from "react";

import { getCategories } from "@/lib/api";
import { PanelArriving, ValueArriving } from "@/components/ui/Arriving";
import { categoryHref } from "@/lib/format";
import type { Category } from "@/lib/types";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { CollectionPageJsonLd } from "@/components/seo/CollectionPageJsonLd";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

export const metadata: Metadata = {
  title: "The index — everything we research",
  description:
    "Every category SortedChoice covers, and how far our research has actually got in each one.",
  alternates: { canonical: "/c" },
};

/**
 * All categories (spec §13).
 *
 * Deliberately NOT a bigger version of the homepage tile grid. Tiles are an
 * *entry* affordance — good for eight, illegible for a hundred, and they
 * flatten a three-level taxonomy into one undifferentiated wall. This page is
 * the contents page of the publication instead: numbered departments, each
 * dividing into headed groups of shelves, counts right-aligned in tabular
 * numerals. The three levels of the taxonomy are the three levels of the
 * page — that correspondence is the whole design.
 *
 * The coverage meter is the honest part. Most categories have nothing
 * researched yet, and a directory that hides that would be selling a promise
 * the site cannot keep. Showing "2 of 6 researched" is the same editorial
 * posture as "no sponsored verdicts" — it is the brand, not an apology.
 */

/* ------------------------------------------------------------------ */
/* Tree                                                                */
/* ------------------------------------------------------------------ */

// `Category.children` is optional and typed as Category[]; omit it so the
// recursive form is the only one that survives into the tree.
type Node = Omit<Category, "children"> & { children: Node[] };

/** The API returns a flat list with `parentId`; `children` is never populated. */
function buildTree(categories: Category[]): Node[] {
  const byId = new Map<string, Node>();
  for (const c of categories) {
    if (c.isActive) byId.set(c.id, { ...c, children: [] });
  }

  const roots: Node[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sort = (nodes: Node[]) => {
    nodes.sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name));
    nodes.forEach((n) => sort(n.children));
  };
  sort(roots);

  return roots;
}

/**
 * A lone root ("Electronics") is a container, not a chapter — rendering it as
 * one would give the page a single entry. Collapse it and promote its children.
 * With several roots, the roots *are* the chapters.
 */
function chaptersOf(roots: Node[]): Node[] {
  return roots.length === 1 && roots[0].children.length > 0 ? roots[0].children : roots;
}

/** Products hang off whichever node they were filed under, at any depth. */
function subtreeCount(node: Node): number {
  return (node.productCount ?? 0) + node.children.reduce((sum, c) => sum + subtreeCount(c), 0);
}

function flatten(node: Node): Node[] {
  return [node, ...node.children.flatMap(flatten)];
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function AllCategoriesPage() {
  return (
    <main id="main">
      {/* --- Masthead ------------------------------------------------ */}
      <section className="relative overflow-hidden border-b border-line bg-bg">
        <div className="dot-matrix pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />

        <div className="shell relative py-10 sm:py-12 lg:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "All categories" }]} />

          <div className="mt-6 grid gap-8 sm:mt-8 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="max-w-3xl">
              <p className="t-eyebrow mb-4">The index</p>
              <h1 className="t-display text-ink">Everything we cover.</h1>
              <Suspense fallback={<PanelArriving lines={2} className="mt-6 max-w-xl" />}>
                <Lede />
              </Suspense>
            </div>

            {/* Ledger — tabular figures, hairline-separated. Reads as a
                masthead stat block rather than a row of stat cards. */}
            <Suspense fallback={<LedgerArriving />}>
              <Ledgers />
            </Suspense>
          </div>
        </div>
      </section>

      {/* --- Chapters --- */}
      <Suspense fallback={<div className="shell-wide pb-20 pt-10 lg:pb-28 lg:pt-16" aria-hidden="true" />}>
        <Chapters />
      </Suspense>
      {/* No `itemListId`: this is a DIRECTORY, not a ranking. The order on
          screen is alphabetical-ish and carries no editorial claim, so an
          `ItemList` with `itemListOrder` would assert one we are not making.
          The category and product pages are where the rankings live. */}
      <CollectionPageJsonLd
        path="/c"
        name="The index — everything we research"
        description="Every category SortedChoice covers, and how far our research has actually got in each one."
      />
    </main>
  );
}

function Ledger({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div>
      <dd
        className={`tabular font-display text-headline-lg font-bold leading-none ${
          accent ? "text-brand" : "text-ink"
        }`}
      >
        {value}
      </dd>
      <dt className="t-eyebrow mt-2.5">{label}</dt>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter                                                             */
/* ------------------------------------------------------------------ */

/**
 * One block of the index: a heading and the shelves under it.
 *
 * `head` is null for shelves filed straight onto a department when that
 * department has nothing else — a heading that repeats the chapter title
 * directly beneath the chapter title labels nothing.
 */
type Block = { key: string; head: Node | null; leaves: Node[] };

/**
 * How a department divides into blocks.
 *
 * A child with children of its own is a group — "Audio", holding six shelves.
 * A child without is a shelf hanging directly off the department, which has no
 * group to belong to and so is collected into one block at the end.
 */
function blocksOf(chapter: Node): Block[] {
  const groups = chapter.children.filter((c) => c.children.length > 0);
  const loose = chapter.children.filter((c) => c.children.length === 0);

  const blocks: Block[] = groups.map((group) => ({
    key: group.id,
    head: group,
    // The group's branch, flattened. The reader wants the destination, not the
    // shape of our database — and below a group the tree is one level deep.
    leaves: group.children.length ? group.children.flatMap(flatten) : [group],
  }));

  if (loose.length) {
    // Heading only when there are groups to distinguish these from.
    blocks.push({ key: `${chapter.id}:direct`, head: groups.length ? chapter : null, leaves: loose });
  }

  // A department with nothing under it is still a destination.
  if (!blocks.length) blocks.push({ key: chapter.id, head: null, leaves: [chapter] });

  return blocks;
}

/**
 * A department — Electronics, Home & Kitchen — and everything filed under it.
 *
 * WHAT THIS REPLACED. The chapter used to flatten its whole branch into a
 * single list: `chapter.children.flatMap(flatten)`. That was fine when the
 * catalogue had one root and eight shallow sections. Against two departments
 * of ~50 categories each it produced two columns fifty rows deep and the best
 * part of four thousand pixels tall, in which "Audio" — a section holding six
 * shelves — and "Earbuds" — one of those shelves — were the same row at the
 * same indent. The taxonomy this page exists to show was the one thing it did
 * not show, and on a phone the whole thing was a single unbroken scroll.
 *
 * Now the department's children are blocks, each with its own heading and its
 * own shelves beneath it, and the blocks flow into columns: one on a phone,
 * two from `sm`, up to four on a wide display. `columns` rather than `grid`
 * because the blocks are wildly uneven — six shelves under Audio, two under
 * Coffee & Beverage — and a grid row is as tall as its tallest cell, so every
 * short block would sit above a hole. Columns pack them instead.
 */
function Chapter({ chapter, index }: { chapter: Node; index: number }) {
  // The subtree includes the chapter node itself, because products are filed
  // against whichever node an editor chose: "Audio" holds two directly while
  // every one of its leaves holds none. Measuring coverage over the leaves
  // alone reported 0% for a branch that is demonstrably covered.
  const subtree = flatten(chapter);
  const covered = subtree.filter((n) => (n.productCount ?? 0) > 0).length;
  const total = subtreeCount(chapter);
  const ratio = subtree.length ? covered / subtree.length : 0;

  return (
    <section aria-labelledby={`chapter-${chapter.slug}`}>
      {/* --- Chapter head --- */}
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          className="tabular mt-1 shrink-0 font-mono text-label-xs font-medium tracking-[0.14em] text-ink-faint"
          aria-hidden="true"
        >
          {String(index).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <Link
              href={categoryHref(chapter)}
              id={`chapter-${chapter.slug}`}
              className="group inline-flex min-w-0 items-center gap-2.5 text-ink transition-colors duration-fast hover:text-brand"
            >
              <CategoryIcon
                name={chapter.icon}
                className="h-5 w-5 shrink-0 text-ink-subtle transition-colors duration-fast group-hover:text-brand"
              />
              <span className="truncate font-display text-headline-sm font-semibold tracking-[-0.02em]">
                {chapter.name}
              </span>
            </Link>

            <span className="tabular shrink-0 font-mono text-label-xs text-ink-subtle">
              {total > 0 ? `${total} researched` : "—"}
            </span>
          </div>

          {/* Coverage: a 2px rule, not a rounded progress pill. The track is
              the same hairline that separates the rows below it, so the meter
              reads as part of the ruling rather than a widget dropped on top. */}
          <div
            className="mt-4 h-[2px] w-full bg-line"
            role="img"
            aria-label={`${covered} of ${subtree.length} categories in this branch have research`}
          >
            <div
              className="h-full bg-brand transition-all duration-slow ease-ease"
              style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 4 : 0)}%` }}
            />
          </div>
        </div>
      </div>

      {/* --- Blocks --- */}
      <div className="mt-8 gap-x-10 sm:columns-2 lg:pl-[2.1rem] xl:columns-3 2xl:gap-x-14 2xl:columns-4">
        {blocksOf(chapter).map((block) => (
          <IndexBlock key={block.key} block={block} />
        ))}
      </div>
    </section>
  );
}

/**
 * `break-inside-avoid` is what makes the column layout legible rather than
 * merely compact: without it a group's heading lands at the foot of one column
 * with its shelves at the head of the next, and the reader has to reassemble
 * the grouping by eye.
 */
function IndexBlock({ block }: { block: Block }) {
  const { head, leaves } = block;
  const count = head ? subtreeCount(head) : 0;

  return (
    <div className="mb-9 break-inside-avoid">
      {head ? (
        <Link
          href={categoryHref(head)}
          className="group flex items-baseline justify-between gap-3 border-b border-line pb-2.5"
        >
          <span className="truncate font-display text-body-lg font-semibold tracking-[-0.015em] text-ink transition-colors duration-fast group-hover:text-brand">
            {head.name}
          </span>
          <span
            className={`tabular shrink-0 font-mono text-label-xs ${
              count > 0 ? "text-ink-muted" : "text-ink-faint"
            }`}
          >
            {count > 0 ? count : "—"}
          </span>
        </Link>
      ) : null}

      <ul>
        {leaves.map((leaf) => (
          <Leaf key={leaf.id} leaf={leaf} />
        ))}
      </ul>
    </div>
  );
}

function Leaf({ leaf }: { leaf: Node }) {
  const count = leaf.productCount ?? 0;
  const researched = count > 0;

  return (
    <li className="border-b border-line-faint last:border-b-0">
      <Link
        href={categoryHref(leaf)}
        className="group flex items-baseline justify-between gap-4 py-3 transition-colors duration-fast"
      >
        <span
          className={`flex min-w-0 items-baseline gap-2 text-body-md transition-colors duration-fast ${
            researched ? "text-ink group-hover:text-brand" : "text-ink-subtle group-hover:text-ink"
          }`}
        >
          <span className="truncate">{leaf.name}</span>
          {/* The arrow occupies its slot at all times so the row never reflows
              on hover — motion should be the arrow, not the text. */}
          <span
            className="shrink-0 translate-x-0 text-brand opacity-0 transition-all duration-fast ease-ease
                       group-hover:translate-x-1 group-hover:opacity-100"
            aria-hidden="true"
          >
            →
          </span>
        </span>

        {/* A column of thirty zeroes reads as a failed render. An em dash reads
            as "nothing yet" and leaves real counts the only numerals here. */}
        <span
          className={`tabular shrink-0 font-mono text-label-xs ${
            researched ? "text-ink-muted" : "text-ink-faint"
          }`}
        >
          {researched ? count : "—"}
        </span>
      </Link>
    </li>
  );
}

/**
 * The index is the taxonomy, so unlike most pages here there is nothing to
 * render from local knowledge except the masthead's own copy. That is still
 * worth splitting out: the headline and the breadcrumb identify the
 * destination immediately, and the three counts and the chapter grid — all
 * derived from one memoized `getCategories()` — arrive together behind it.
 */
async function tree() {
  const chapters = chaptersOf(buildTree(await getCategories()));
  return { chapters, every: chapters.flatMap(flatten) };
}

async function Lede() {
  const { every } = await tree();
  return (
    <p className="mt-6 max-w-xl text-body-lg text-ink-muted">
      {every.length} categories, and an honest account of how far we have actually got in each
      one. We would rather show you the gaps than pretend they are not there.
    </p>
  );
}

/* Ledger — tabular figures, hairline-separated. Reads as a masthead stat block
   rather than a row of stat cards. */
async function Ledgers() {
  const { every } = await tree();
  const researched = every.filter((c) => (c.productCount ?? 0) > 0).length;
  const products = every.reduce((sum, c) => sum + (c.productCount ?? 0), 0);

  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-6 sm:gap-x-10 lg:justify-end">
      <Ledger value={every.length} label="Categories" />
      <Ledger value={researched} label="With research" accent />
      <Ledger value={products} label="Products" />
    </dl>
  );
}

function LedgerArriving() {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-6 sm:gap-x-10 lg:justify-end">
      {["Categories", "With research", "Products"].map((label) => (
        <div key={label}>
          <dd className="tabular font-display text-headline-lg font-bold leading-none text-ink">
            <ValueArriving width={3} />
          </dd>
          <dt className="t-eyebrow mt-2.5">{label}</dt>
        </div>
      ))}
    </dl>
  );
}

async function Chapters() {
  const { chapters } = await tree();

  return (
    <div className="shell-wide pb-20 pt-10 lg:pb-28 lg:pt-16">
      {/* Departments are stacked, not tiled. They used to be tracks in an
          `auto-fill` grid, which was right for eight small chapters and wrong
          for two large ones: at any width above 700px the page became two tall
          columns with the entire right-hand half of a 1900px screen left empty.
          A department is now a full-width band that divides internally, so the
          available width is spent on the shelves rather than on whitespace. */}
      <div className="stagger flex flex-col">
        {chapters.map((chapter, i) => (
          <div
            key={chapter.id}
            className="border-t border-line pt-10 mt-12 first:mt-0 first:border-t-0 first:pt-0 lg:pt-14 lg:mt-16"
          >
            <Chapter chapter={chapter} index={i + 1} />
          </div>
        ))}
      </div>
    </div>
  );
}
