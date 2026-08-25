import type { Metadata } from "next";
import Link from "next/link";

import { Suspense } from "react";

import { getCategories } from "@/lib/api";
import { PanelArriving, ValueArriving } from "@/components/ui/Arriving";
import { categoryHref } from "@/lib/format";
import type { Category } from "@/lib/types";

import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
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
 * *entry* affordance — good for eight, illegible for thirty-six, and they
 * flatten a three-level taxonomy into one undifferentiated wall. This page is
 * the contents page of the publication instead: numbered chapters, leaf
 * categories as typographic rows, counts right-aligned in tabular numerals.
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

        <div className="shell relative py-12 lg:py-16">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "All categories" }]} />

          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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
      <Suspense fallback={<div className="shell-wide pb-24 pt-14 lg:pt-20" aria-hidden="true" />}>
        <Chapters />
      </Suspense>
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

function Chapter({ chapter, index }: { chapter: Node; index: number }) {
  // Two different sets, deliberately. `listed` is what the reader sees — the
  // branch flattened, because they want the destination, not the shape of our
  // database. `subtree` includes the chapter node itself, because products are
  // filed against whichever node an editor chose: "Audio" holds two directly
  // while every one of its leaves holds none. Measuring coverage over `listed`
  // alone reported 0% for a branch that is demonstrably covered.
  const listed = chapter.children.length ? chapter.children.flatMap(flatten) : [chapter];
  const subtree = flatten(chapter);
  const covered = subtree.filter((n) => (n.productCount ?? 0) > 0).length;
  const total = subtreeCount(chapter);
  const ratio = subtree.length ? covered / subtree.length : 0;

  return (
    <section aria-labelledby={`chapter-${chapter.slug}`}>
      {/* --- Chapter head --- */}
      <div className="flex items-start gap-4">
        <span
          className="tabular mt-0.5 shrink-0 font-mono text-label-xs font-medium tracking-[0.14em] text-ink-faint"
          aria-hidden="true"
        >
          {String(index).padStart(2, "0")}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <Link
              href={categoryHref(chapter)}
              id={`chapter-${chapter.slug}`}
              className="group inline-flex items-center gap-2.5 text-ink transition-colors duration-fast hover:text-brand"
            >
              <CategoryIcon
                name={chapter.icon}
                className="h-4.5 w-4.5 shrink-0 text-ink-subtle transition-colors duration-fast group-hover:text-brand"
              />
              <span className="font-display text-headline-sm font-semibold tracking-[-0.02em]">
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

      {/* --- Leaves --- */}
      <ul className="mt-1 lg:pl-[2.1rem]">
        {listed.map((leaf) => (
          <Leaf key={leaf.id} leaf={leaf} />
        ))}
      </ul>
    </section>
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
    <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end">
      <Ledger value={every.length} label="Categories" />
      <Ledger value={researched} label="With research" accent />
      <Ledger value={products} label="Products" />
    </dl>
  );
}

function LedgerArriving() {
  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-6 lg:justify-end">
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
    <div className="shell-wide pb-24 pt-14 lg:pt-20">
      <div
        className="stagger grid gap-x-16 gap-y-14"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))" }}
      >
        {chapters.map((chapter, i) => (
          <Chapter key={chapter.id} chapter={chapter} index={i + 1} />
        ))}
      </div>
    </div>
  );
}
