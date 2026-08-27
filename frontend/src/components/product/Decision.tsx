import Link from "next/link";

import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { AlternativeReason, VerdictStance } from "@/lib/types";

/**
 * The decision layer of the product page.
 *
 * Everything here exists to answer one question before the reader scrolls:
 * *should I buy this?* The page used to answer it only by implication — a
 * paragraph of verdict prose that a reader had to parse for a conclusion, two
 * screens below a specification table nobody came for.
 *
 * The pieces, in the order the page uses them:
 *
 *   VerdictBanner  — the recommendation itself, and the one-line why.
 *   QuickSummary   — the same argument in fifteen seconds, four columns.
 *   BuyingOptions  — where to get it, with every affiliate link labelled.
 *   ResearchNote   — how the verdict was reached, and what it does NOT claim.
 *   TrustLinks     — the four documents that make the above checkable.
 *
 * Colour grammar (docs/01-design-brainstorm.md §2) is unchanged: purple frames
 * OUR judgement, orange only ever leaves the site. The stance tint sits inside
 * the purple frame rather than replacing it — a green SKIP-shaped panel would
 * read as a different kind of object depending on the answer, and the reader
 * should recognise the verdict block before they read it.
 */

/* ------------------------------------------------------------------ */
/* 1. The verdict                                                      */
/* ------------------------------------------------------------------ */

type StanceTone = "value" | "warn" | "danger" | "brand";

const STANCE: Record<
  VerdictStance,
  { label: string; gloss: string; tone: StanceTone }
> = {
  buy_now: {
    label: "Buy now",
    gloss: "Worth its price today",
    tone: "value",
  },
  wait_for_sale: {
    label: "Wait for a sale",
    gloss: "Right product, wrong price",
    tone: "warn",
  },
  skip: {
    label: "Skip",
    gloss: "Not worth it at any price we expect",
    tone: "danger",
  },
  consider_alternative: {
    label: "Consider an alternative",
    gloss: "Something else does this better for you",
    tone: "brand",
  },
};

const TONE: Record<StanceTone, { chip: string; rule: string; mark: string }> = {
  value: {
    chip: "border-value-line bg-value-soft text-value-on-soft",
    rule: "bg-value",
    mark: "text-value",
  },
  warn: {
    chip: "border-warn-line bg-warn-soft text-warn-on-soft",
    rule: "bg-warn",
    mark: "text-warn",
  },
  danger: {
    chip: "border-danger-line bg-danger-soft text-danger-on-soft",
    rule: "bg-danger",
    mark: "text-danger",
  },
  brand: {
    chip: "border-brand-line bg-brand-soft text-brand-on-soft",
    rule: "bg-brand-vivid",
    mark: "text-brand",
  },
};

/**
 * The answer, above the fold.
 *
 * Renders nothing without a stance rather than falling back to a neutral
 * "we're still looking at this" — an empty verdict banner is worse than no
 * banner, and the publish check already refuses a product that has not got
 * one, so the absent case only happens on a draft preview.
 */
export function VerdictBanner({
  stance,
  summary,
  className,
  headingId = "verdict-banner-heading",
}: {
  stance?: VerdictStance | null;
  summary?: string | null;
  className?: string;
  headingId?: string;
}) {
  if (!stance) return null;

  const { label, gloss, tone } = STANCE[stance];
  const t = TONE[tone];

  return (
    <section
      aria-labelledby={headingId}
      className={cn("panel relative overflow-hidden p-5 pl-6 sm:p-7 sm:pl-8", className)}
    >
      {/* The rule takes the stance colour, the panel does not. One thin line
          is enough to signal the answer at a glance without the block
          changing species between products. */}
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", t.rule)} aria-hidden="true" />

      <h2 id={headingId} className="t-eyebrow text-brand">
        Should you buy this?
      </h2>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-xs border px-3.5 py-2",
            "font-label text-label-xs font-bold uppercase tracking-[0.12em]",
            t.chip,
          )}
        >
          <StanceGlyph stance={stance} />
          {label}
        </span>
        <span className="text-body-sm text-ink-subtle">{gloss}</span>
      </div>

      {summary && (
        <p className="shell-prose mt-4 text-body-md leading-relaxed text-ink sm:text-body-lg">
          {summary}
        </p>
      )}
    </section>
  );
}

function StanceGlyph({ stance }: { stance: VerdictStance }) {
  const paths: Record<VerdictStance, string> = {
    // A tick, a clock hand, a slash, a fork in the road. Decorative — the
    // label carries the meaning, so these are aria-hidden.
    buy_now: "m3 8.5 3.2 3.2L13 5",
    wait_for_sale: "M8 4.5V8l2.5 1.8",
    skip: "M4 4l8 8M12 4l-8 8",
    consider_alternative: "M3 12h3.5L9 4h4M11 2l2 2-2 2",
  };

  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      {stance === "wait_for_sale" && (
        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
      )}
      <path
        d={paths[stance]}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Fifteen-second summary                                           */
/* ------------------------------------------------------------------ */

/**
 * The whole argument, scannable in four columns.
 *
 * Derived from the fields an editor already fills in rather than being a fifth
 * thing to write. Two reasons, and the second is the important one:
 *
 *  - A summary authored separately drifts. It would be written once, the pros
 *    would be revised, and the top of the page would keep arguing the old
 *    case — on the block a reader is most likely to be the ONLY thing they
 *    read.
 *  - Nothing here can be blank on a published product: pros, cons and the
 *    audience lists are all publish requirements.
 *
 * Only the leading items are shown. This is the fifteen-second read; the full
 * lists are directly below it and lose nothing by being read second.
 */
export function QuickSummary({
  pros,
  cons,
  bestFor,
  notIdealFor,
  className,
}: {
  pros: string[];
  cons: string[];
  bestFor: string[];
  notIdealFor: string[];
  className?: string;
}) {
  const cells = [
    { title: "What's good", items: pros.slice(0, 3), tone: "value" as const },
    { title: "What's not", items: cons.slice(0, 3), tone: "danger" as const },
    { title: "Buy it if you are", items: bestFor.slice(0, 3), tone: "value" as const },
    { title: "Look elsewhere if", items: notIdealFor.slice(0, 3), tone: "muted" as const },
  ].filter((c) => c.items.length > 0);

  if (cells.length === 0) return null;

  return (
    <section aria-labelledby="quick-summary-heading" className={cn("panel p-6 sm:p-8", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="quick-summary-heading" className="t-eyebrow text-brand">
          The 15-second summary
        </h2>
        <p className="text-body-sm text-ink-subtle">
          The short version. Everything below argues it.
        </p>
      </div>

      <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.title} className="min-w-0">
            <h3
              className={cn(
                "t-eyebrow",
                cell.tone === "value"
                  ? "text-value"
                  : cell.tone === "danger"
                    ? "text-danger"
                    : "text-ink-subtle",
              )}
            >
              {cell.title}
            </h3>
            <ul className="mt-3 space-y-2">
              {cell.items.map((item) => (
                <li key={item} className="flex gap-2.5 text-body-sm leading-relaxed text-ink-muted">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      cell.tone === "value"
                        ? "bg-value"
                        : cell.tone === "danger"
                          ? "bg-danger"
                          : "bg-ink-faint",
                    )}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. How we reviewed this                                             */
/* ------------------------------------------------------------------ */

/**
 * How the verdict was reached — and, just as importantly, what it does not
 * claim.
 *
 * ---------------------------------------------------------------------------
 * This box used to open with a paragraph describing our method ("we researched
 * the published specifications, compared this against the products competing
 * with it…") and, below it, whatever per-product note an editor had written.
 * Both are gone. The method paragraph was identical on every page, so it read
 * as boilerplate and got skipped — which is a problem, because the ONE line
 * underneath it that is not boilerplate got skipped with it.
 *
 * What remains is the single claim that is actually load-bearing: whether
 * anybody here has held this product. It is stated as a checked item rather
 * than prose so it reads as a declaration on the record — the same shape a
 * spec sheet uses — instead of as more copy to scroll past.
 *
 * `handsOnTested` is the only input, and it defaults to false in the schema,
 * the API and the database. So the failure mode is a page that under-claims,
 * never one that quietly asserts a reviewer held something they never held.
 * The negative is stated explicitly rather than left to inference, because "we
 * reviewed this" is read as "we tested this" unless a page says otherwise —
 * and /how-we-score points readers at this box by name for the answer.
 *
 * `note` is still accepted and still deliberately unrendered: the call site
 * passes it, the admin form still writes it, and the field is not lost — it is
 * simply not shown while the box is this pared back.
 */
export function ResearchNote({
  handsOnTested = false,
  note: _note,
  researchedAt,
  className,
}: {
  handsOnTested?: boolean;
  /** Kept on the API and in the CMS; not rendered here. See above. */
  note?: string | null;
  researchedAt?: string | null;
  className?: string;
}) {
  return (
    <section aria-labelledby="research-heading" className={cn("panel p-6 sm:p-8", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="research-heading" className="t-eyebrow text-brand">
          How we reviewed this
        </h2>
        {researchedAt && (
          <p className="tabular font-mono text-label-xs uppercase tracking-[0.14em] text-ink-subtle">
            Last researched {formatDate(researchedAt)}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-start gap-3">
        {/* Decorative: the sentence beside it carries the whole meaning, and a
            screen reader announcing "checked" before it would imply a control
            that can be toggled. */}
        <span
          aria-hidden="true"
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-xs border",
            handsOnTested
              ? "border-value-line bg-value-soft text-value-on-soft"
              : "border-brand-line bg-brand-soft text-brand-on-soft",
          )}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m3 8.5 3.2 3.2L13 5" />
          </svg>
        </span>

        <p className="text-body-sm leading-relaxed text-ink-muted">
          {handsOnTested ? (
            <>
              <strong className="font-semibold text-ink">
                We have used this product ourselves.
              </strong>{" "}
              This verdict is backed by hands-on testing alongside the research.
            </>
          ) : (
            <>
              <strong className="font-semibold text-ink">
                This is a research verdict, not a hands-on test.
              </strong>{" "}
              Nobody here has used this particular unit. Where we have tested a product
              ourselves, the page says so in this box — and where it does not say so, we
              have not.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Trust and transparency                                           */
/* ------------------------------------------------------------------ */

const TRUST_LINKS = [
  { label: "How we score products", href: "/how-we-score" },
  { label: "How we research", href: "/how-we-research" },
  { label: "Editorial policy", href: "/editorial-policy" },
  { label: "Affiliate disclosure", href: "/affiliate-disclosure" },
] as const;

/**
 * Four links, one line, no panel.
 *
 * A boxed "trust centre" would compete with the verdict for weight while
 * telling the reader nothing they asked for. These are here for the reader who
 * has just been told what to buy and wants to know who is telling them — so
 * they sit directly under the research note, quiet until wanted.
 */
export function TrustLinks({ className }: { className?: string }) {
  return (
    <nav
      aria-label="How SortedChoice works"
      className={cn("flex flex-wrap items-center gap-x-6 gap-y-3", className)}
    >
      {TRUST_LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className="group inline-flex items-center gap-1.5 font-label text-label-xs font-semibold
                     uppercase tracking-[0.12em] text-ink-subtle transition-colors duration-fast
                     hover:text-brand"
        >
          {l.label}
          <span
            aria-hidden="true"
            className="transition-transform duration-fast ease-ease group-hover:translate-x-0.5"
          >
            →
          </span>
        </Link>
      ))}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Alternatives — the reason chips                                  */
/* ------------------------------------------------------------------ */

export const ALTERNATIVE_REASON: Record<AlternativeReason, string> = {
  better_value: "Better value",
  better_performance: "Better performance",
  better_budget: "Better budget option",
  better_for_professionals: "Better for professionals",
  better_features: "More features",
  closest_rival: "Closest rival",
};

/** The chip that sits above an alternative's card, saying why it is here. */
export function ReasonChip({
  reason,
  curated,
  className,
}: {
  reason: AlternativeReason;
  /** Curated picks are OUR claim and get the brand tint; heuristic neighbours
   *  get a neutral one. Styling them alike would put an editorial claim on a
   *  row an editor never wrote. */
  curated: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border px-2.5 py-1",
        "font-label text-label-xs font-bold uppercase tracking-[0.1em]",
        curated
          ? "border-brand-line bg-brand-soft text-brand-on-soft"
          : "border-line text-ink-subtle",
        className,
      )}
    >
      {curated ? ALTERNATIVE_REASON[reason] : "Similar price"}
    </span>
  );
}
