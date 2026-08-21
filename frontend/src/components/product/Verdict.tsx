import { cn } from "@/lib/cn";
import type { SpecGroup } from "@/lib/types";

/**
 * The PickD Verdict (spec §25) — admin-authored prose, the reason this platform
 * exists. Marked with a purple rule because it is *our* judgement (the colour
 * grammar: purple = deciding).
 *
 * Constrained to the prose measure even though the page is full-bleed: width is
 * for grids, not paragraphs (docs/01-design-brainstorm.md §3.2).
 */
export function VerdictBlock({ verdict }: { verdict: string }) {
  return (
    <section aria-labelledby="verdict-heading" className="relative pl-6">
      <span className="absolute left-0 top-1 h-[calc(100%-0.5rem)] w-[3px] rounded-full bg-brand-vivid" aria-hidden="true" />
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
 */
export function AudienceFit({ bestFor, notIdealFor }: { bestFor: string[]; notIdealFor: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FitPanel title="Best for" items={bestFor} tone="value" />
      <FitPanel title="Not ideal for" items={notIdealFor} tone="muted" />
    </div>
  );
}

function FitPanel({ title, items, tone }: { title: string; items: string[]; tone: "value" | "muted" }) {
  return (
    <div className="panel p-6">
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
export function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="panel p-6">
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
      <div className="panel p-6">
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
    </div>
  );
}

/**
 * Specifications (spec §18). Values are mono and tabular so numbers align down
 * the column — the detail that makes the page feel engineered.
 */
export function SpecTable({ groups }: { groups: SpecGroup[] }) {
  return (
    <div className="panel divide-y divide-line overflow-hidden">
      {groups.map((group) => (
        <div key={group.label} className="p-6">
          <h3 className="t-eyebrow">{group.label}</h3>
          <dl className="mt-4 divide-y divide-line-faint">
            {group.items.map((item) => (
              <div key={item.label} className="flex items-baseline justify-between gap-6 py-2.5">
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
