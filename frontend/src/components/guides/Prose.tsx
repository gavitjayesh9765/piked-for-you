import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * The two presentational pieces the guide bodies use besides the chart.
 *
 * Kept deliberately small. Every component added here is a component an author
 * has to know about, and a guide is meant to be mostly prose — the moment there
 * are nine block types, articles start being assembled from widgets rather than
 * written, and they read like it.
 */

/* --------------------------------------------------------------------- */
/* Callout                                                                */
/* --------------------------------------------------------------------- */

/**
 * An aside that interrupts the argument on purpose.
 *
 * Three tones, and the distinction is about what the reader should DO:
 *
 *   note  — context that is useful and optional. Skippable.
 *   watch — a way to be misled, usually by a manufacturer's own number. Not
 *           skippable, and styled to stop the eye, because these articles exist
 *           largely to defuse specific marketing claims.
 *   buy   — the practical consequence for somebody spending money. The reason
 *           the reader is here, so it gets the value accent the rest of the
 *           site reserves for worth-it signals.
 */
export function Callout({
  tone = "note",
  title,
  children,
}: {
  tone?: "note" | "watch" | "buy";
  title: string;
  children: ReactNode;
}) {
  const tones = {
    note: "border-line bg-surface-1 [--co-accent:var(--c-ink-muted)]",
    watch: "border-warn-line bg-warn-soft/50 [--co-accent:var(--c-warn-on-soft)]",
    buy: "border-value-line bg-value-soft/50 [--co-accent:var(--c-value-on-soft)]",
  } as const;

  return (
    <aside className={cn("not-prose my-8 rounded-md border px-5 py-4", tones[tone])}>
      <p
        className="font-label text-label-xs font-semibold uppercase tracking-[0.14em]"
        style={{ color: "var(--co-accent)" }}
      >
        {title}
      </p>
      {/* `doc-prose` rather than bare children so paragraphs and lists inside a
          callout keep the same rhythm as the surrounding article. */}
      <div className="doc-prose mt-2.5 !max-w-none text-body-sm">{children}</div>
    </aside>
  );
}

/* --------------------------------------------------------------------- */
/* DataTable                                                              */
/* --------------------------------------------------------------------- */

export type TableColumn = {
  key: string;
  label: string;
  /** Right-align and render in tabular mono. For numbers and ranges only. */
  numeric?: boolean;
};

/**
 * A real table, for the data that is genuinely tabular.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE ARE NOT ALL CHARTS
 *
 * The bar chart answers "who is faster". A table answers "what does this
 * specific thing mean", and a decoder — what `H` means in a CPU name, which
 * resolution a card is comfortable at — has no magnitude to plot. Drawing one
 * as a chart would be decoration standing in for information.
 *
 * There is a second reason, and it is the one that decided the markup. Answer
 * engines extract from `<table>` extremely well and from a div-grid barely at
 * all: a real `<th scope>` tells a model which cell is the answer to which
 * question, where a styled grid hands it a bag of strings. Every one of these
 * tables is written expecting to be quoted as a row.
 *
 * ---------------------------------------------------------------------------
 * ⚠ THE HORIZONTAL SCROLL IS DELIBERATE AND MUST STAY CONTAINED
 *
 * A four-column table does not fit a 360px phone, and the alternatives are all
 * worse: shrinking the type below the 16px floor this site holds, wrapping
 * every cell into unreadable ribbons, or the "stacked cards on mobile" pattern
 * that destroys exactly the row-and-column structure the markup exists for.
 *
 * So the table scrolls inside its own box. `tabindex={0}` on the scroll
 * container is not optional — a keyboard user with no pointer otherwise cannot
 * reach the columns past the fold, which is a documented WCAG failure and the
 * usual thing this pattern gets wrong.
 */
export function DataTable({
  caption,
  columns,
  rows,
  note,
}: {
  /** What the table shows. Rendered, not just for screen readers. */
  caption: string;
  columns: TableColumn[];
  rows: Array<Record<string, ReactNode>>;
  /** Optional line under the table — provenance, or the caveat that applies. */
  note?: string;
}) {
  return (
    <figure className="not-prose my-10">
      <div
        tabIndex={0}
        role="region"
        aria-label={caption}
        className="overflow-x-auto rounded-lg border border-line bg-surface-0
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-[color:var(--c-focus)]"
      >
        {/*
          `min-w` is what makes the scroll above actually happen.

          Without it, `w-full` lets the table shrink to the container and every
          cell wraps instead — which is not the graceful degradation it looks
          like. A four-word cell becomes four stacked words, row heights triple,
          and the columns stop reading as columns, which is the one property a
          table exists to provide. The scroll container was already here; it had
          nothing to scroll.

          38rem is chosen to be just past a large phone in portrait, so narrow
          screens scroll and everything from a small tablet up fits without one.
        */}
        <table className="w-full min-w-[38rem] border-collapse text-left">
          <caption className="border-b border-line px-5 py-4 text-left">
            <span className="t-eyebrow !text-ink">{caption}</span>
          </caption>
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-5 py-3 font-label text-label-xs font-semibold uppercase",
                    "tracking-[0.12em] text-ink-subtle",
                    c.numeric && "text-right",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-line-faint last:border-b-0">
                {columns.map((c, j) => {
                  // The first column is the row's subject, so it is a `th` with
                  // a row scope. This is the association that lets a screen
                  // reader — and a model — say "the H suffix means 45 watts"
                  // rather than reading two unrelated cells in sequence.
                  const Cell = j === 0 ? "th" : "td";
                  return (
                    <Cell
                      key={c.key}
                      {...(j === 0 ? { scope: "row" as const } : {})}
                      className={cn(
                        "px-5 py-3.5 align-top text-body-sm",
                        j === 0 ? "font-medium text-ink" : "text-ink-muted",
                        c.numeric && "tabular whitespace-nowrap text-right",
                      )}
                    >
                      {row[c.key]}
                    </Cell>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {note ? (
        <figcaption className="mt-3 text-body-sm text-ink-subtle">{note}</figcaption>
      ) : null}
    </figure>
  );
}
