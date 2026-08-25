import { cn } from "@/lib/cn";
import type { SpecGroup } from "@/lib/types";

/**
 * The PickD Verdict (spec §25) — admin-authored prose, the reason this platform
 * exists. Marked with a purple rule because it is *our* judgement (the colour
 * grammar: purple = deciding).
 *
 * It sits on a panel like everything else in the research column: a bare block
 * of prose floating between two bordered panels read as a gap in the page
 * rather than as the page's most important paragraph.
 *
 * The measure stays capped even though the panel is wider: width is for grids,
 * not paragraphs (docs/01-design-brainstorm.md §3.2).
 */
export function VerdictBlock({ verdict, className }: { verdict: string; className?: string }) {
  return (
    <section
      aria-labelledby="verdict-heading"
      className={cn("panel relative overflow-hidden p-6 pl-7 sm:p-8 sm:pl-9", className)}
    >
      <span className="absolute inset-y-0 left-0 w-[3px] bg-brand-vivid" aria-hidden="true" />
      <h2 id="verdict-heading" className="t-eyebrow text-brand">
        Our verdict
      </h2>
      <div className="shell-prose mt-4 space-y-4 text-body-lg leading-relaxed text-ink">
        {verdict.split("\n\n").map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </section>
  );
}

/**
 * Best For / Not Ideal For (spec §25). Paired panels, never one merged list —
 * the value of this block is that a reader can find themselves in one column
 * and stop reading.
 *
 * `className` replaces the layout wholesale rather than being appended to it,
 * because `cn` is a plain joiner: appending `lg:grid-cols-1` to a base that
 * already sets `md:grid-cols-2` would leave the winner to stylesheet order.
 * An empty side renders nothing — an outlined box containing no list items is
 * the kind of hole that makes a page look unfinished.
 */
export function AudienceFit({
  bestFor,
  notIdealFor,
  className = "grid gap-4 md:grid-cols-2",
}: {
  bestFor: string[];
  notIdealFor: string[];
  className?: string;
}) {
  const panels = (
    [
      { title: "Best for", items: bestFor, tone: "value" },
      { title: "Not ideal for", items: notIdealFor, tone: "muted" },
    ] as const
  ).filter((p) => p.items.length > 0);

  if (panels.length === 0) return null;

  return (
    <div className={className}>
      {panels.map((p) => (
        <FitPanel key={p.title} title={p.title} items={p.items} tone={p.tone} />
      ))}
    </div>
  );
}

function FitPanel({ title, items, tone }: { title: string; items: string[]; tone: "value" | "muted" }) {
  return (
    <div className="panel p-5 sm:p-6">
      <h3 className={cn("t-eyebrow", tone === "value" ? "text-value" : "text-ink-subtle")}>{title}</h3>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-body-md text-ink-muted">
            <span
              aria-hidden="true"
              className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", tone === "value" ? "bg-value" : "bg-ink-faint")}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pros and cons (spec §25) — scannable, paired, colour-coded. */
export function ProsCons({
  pros,
  cons,
  className = "grid gap-4 md:grid-cols-2",
}: {
  pros: string[];
  cons: string[];
  className?: string;
}) {
  if (pros.length === 0 && cons.length === 0) return null;

  return (
    <div className={className}>
      {pros.length > 0 && (
        <div className="panel p-5 sm:p-6">
          <h3 className="t-eyebrow text-value">Pros</h3>
          <ul className="mt-4 space-y-3">
            {pros.map((p) => (
              <li key={p} className="flex gap-3 text-body-md text-ink">
                <CheckGlyph className="mt-1 shrink-0 text-value" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cons.length > 0 && (
        <div className="panel p-5 sm:p-6">
          <h3 className="t-eyebrow text-danger">Cons</h3>
          <ul className="mt-4 space-y-3">
            {cons.map((c) => (
              <li key={c} className="flex gap-3 text-body-md text-ink">
                <CrossGlyph className="mt-1 shrink-0 text-danger" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Specifications, collapsed by default (spec §18).
 *
 * A native <details>, not a state hook. Three things follow from that and all
 * three matter here: it works before hydration, `Ctrl/Cmd-F` finds text inside
 * a closed block in Chrome and Edge, and the disclosure semantics are the
 * browser's rather than an approximation of them.
 *
 * Collapsed is the right default now that the specs sit *below* the verdict.
 * The reader who wants a recommendation should not have to scroll a table of
 * driver diameters to reach the alternatives; the reader who wants the numbers
 * is one click and no page load away, and the count in the summary tells them
 * whether the click is worth making.
 */
export function SpecsDisclosure({
  groups,
  className,
  id = "specifications",
}: {
  groups: SpecGroup[];
  className?: string;
  id?: string;
}) {
  if (groups.length === 0) return null;

  const fields = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <details id={id} className={cn("panel group overflow-hidden", className)}>
      <summary
        className="flex cursor-pointer list-none items-center justify-between gap-4 p-6
                   transition-colors duration-fast hover:bg-surface-1 sm:p-8
                   [&::-webkit-details-marker]:hidden"
      >
        <div className="min-w-0">
          <h2 className="t-eyebrow text-brand">Full specifications</h2>
          <p className="mt-2 text-body-sm text-ink-muted">
            {fields} {fields === 1 ? "figure" : "figures"} across {groups.length}{" "}
            {groups.length === 1 ? "group" : "groups"}. Open only if you need them.
          </p>
        </div>
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line
                     text-ink-muted transition-transform duration-base ease-ease
                     group-open:rotate-180"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="m3.5 6 4.5 4.5L12.5 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </summary>

      <div className="border-t border-line">
        <SpecTable groups={groups} className="rounded-none border-0 bg-transparent" />
      </div>
    </details>
  );
}

/**
 * Specifications (spec §18). Values are mono and tabular so numbers align down
 * the column — the detail that makes the page feel engineered.
 */
export function SpecTable({ groups, className }: { groups: SpecGroup[]; className?: string }) {
  return (
    <div className={cn("panel divide-y divide-line overflow-hidden", className)}>
      {groups.map((group) => (
        <div key={group.label} className="p-5 sm:p-6">
          <h3 className="t-eyebrow">{group.label}</h3>
          <dl className="mt-4 divide-y divide-line-faint">
            {/* A spec label and its value are both unpredictable lengths. On a
                phone they get a 4px gap and the value keeps its right edge; the
                pair wraps to two lines rather than the value being squeezed to
                one character per line. */}
            {group.items.map((item) => (
              <div key={item.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5 sm:gap-x-6">
                <dt className="text-body-sm text-ink-muted">{item.label}</dt>
                <dd className="tabular text-right text-body-sm font-medium text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function CheckGlyph({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="m3 8.5 3.2 3.2L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossGlyph({ className }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
