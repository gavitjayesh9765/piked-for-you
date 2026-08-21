"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { submitContactRequest } from "@/lib/api";
import type { Category, ContactTopic } from "@/lib/types";
import { CategoryIcon } from "@/components/ui/CategoryIcon";

/**
 * Contact / research request form.
 *
 * The design premise: this is a *research desk intake*, not a support ticket.
 * A generic contact form asks name/email/subject/message and learns nothing.
 * This one leads with **what kind of request it is**, and the topic reshapes
 * the fields below — because "research this for me" and "your price is stale"
 * need genuinely different information.
 *
 * The right rail assembles a live **request docket** as you type: mono,
 * tabular, receipt-shaped. It turns filling a form into watching an instrument
 * take a reading, which is the whole personality of the product.
 */

const MAX_CATEGORIES = 4;

const TOPICS: {
  value: ContactTopic;
  label: string;
  blurb: string;
  glyph: React.ReactNode;
}[] = [
  {
    value: "research_request",
    label: "Research a product",
    blurb: "Tell us what you're trying to buy. We'll add it to the queue.",
    glyph: <path d="M4 5h11M4 12h16M4 19h8M18 15v6M15 18h6" />,
  },
  {
    value: "correction",
    label: "Correct a verdict",
    blurb: "A stale price, a wrong spec, or something we simply got wrong.",
    glyph: <path d="M12 8v5M12 16.5v.01M10.3 3.9 2.4 17.3a1.9 1.9 0 0 0 1.6 2.8h16a1.9 1.9 0 0 0 1.6-2.8L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />,
  },
  {
    value: "press",
    label: "Press & partnerships",
    blurb: "Media enquiries, brand contact, anything commercial.",
    glyph: <path d="M4 6h11v12H4zM15 10h3.5L21 12.5V18h-6M7.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM17.5 21a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />,
  },
  {
    value: "general",
    label: "Something else",
    blurb: "Anything that doesn't fit the boxes above.",
    glyph: <path d="M9.2 9a3 3 0 1 1 4.1 2.8c-.8.3-1.3 1.1-1.3 2M12 17.5v.01M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />,
  },
];

const BUDGETS = [
  "Under ₹5,000",
  "₹5,000 – ₹15,000",
  "₹15,000 – ₹30,000",
  "₹30,000 – ₹75,000",
  "Above ₹75,000",
  "Not sure yet",
];

export function ContactForm({ categories }: { categories: Category[] }) {
  const [topic, setTopic] = useState<ContactTopic>("research_request");
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [budget, setBudget] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [organisation, setOrganisation] = useState("");

  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showCategories = topic !== "press";
  const active = TOPICS.find((t) => t.value === topic)!;

  const selectedNames = useMemo(
    () => categories.filter((c) => selected.includes(c.slug)).map((c) => c.name),
    [categories, selected],
  );

  const atLimit = selected.length >= MAX_CATEGORIES;
  const canSubmit =
    email.trim().length > 4 && message.trim().length > 9 && state !== "loading";

  function toggleCategory(slug: string) {
    setSelected((prev) =>
      prev.includes(slug)
        ? prev.filter((s) => s !== slug)
        : prev.length >= MAX_CATEGORIES
          ? prev
          : [...prev, slug],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      const res = await submitContactRequest({
        topic,
        categorySlugs: showCategories ? selected : [],
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
        budgetRange: topic === "research_request" ? budget || null : null,
        productUrl: topic === "correction" ? productUrl.trim() || null : null,
        organisation: topic === "press" ? organisation.trim() || null : null,
      });
      setReference(res.reference);
      setState("done");
    } catch {
      setState("error");
      setError("That didn't send. Try again in a moment.");
    }
  }

  /* ---------------------------------------------------------------- */
  /* Success                                                           */
  /* ---------------------------------------------------------------- */
  if (state === "done") {
    return (
      <div className="panel dot-matrix relative overflow-hidden p-8 lg:p-14">
        <span className="absolute left-0 top-0 h-1 w-full bg-brand-vivid" aria-hidden="true" />
        <div className="max-w-xl">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-value-soft text-value-on-soft">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m4 12.5 5 5L20 6.5" />
            </svg>
          </span>
          <h2 className="mt-6 font-display text-display-lg text-ink">On the desk.</h2>
          <p className="mt-4 text-body-lg text-ink-muted">
            We read every request. If it's a research ask, it goes into the queue and you'll hear
            from a person — not an autoresponder.
          </p>

          <dl className="mt-8 grid gap-px overflow-hidden rounded-md border border-line bg-line">
            <Row label="Reference" value={reference ?? "—"} mono />
            <Row label="Topic" value={active.label} />
            {showCategories && selectedNames.length > 0 && (
              <Row label="Categories" value={selectedNames.join(", ")} />
            )}
            <Row label="Reply to" value={email} />
          </dl>

          <p className="mt-6 text-body-sm text-ink-subtle">
            Quote <span className="font-mono text-ink">{reference}</span> if you follow up.
          </p>

          <button
            type="button"
            onClick={() => {
              setState("idle");
              setMessage("");
              setSelected([]);
            }}
            className="mt-8 font-label text-label uppercase tracking-[0.08em] text-brand hover:underline"
          >
            Send another request
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Form                                                              */
  /* ---------------------------------------------------------------- */
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-14">
      <form onSubmit={submit} noValidate className="min-w-0">
        {/* ---------- 01 · Topic ---------- */}
        <Step n="01" title="What's this about?">
          <fieldset>
            <legend className="sr-only">Request type</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {TOPICS.map((t) => {
                const on = topic === t.value;
                return (
                  <label
                    key={t.value}
                    className={cn(
                      "group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-lg border p-5",
                      "transition-all duration-fast ease-ease",
                      on
                        ? "border-brand-vivid bg-brand-soft shadow-brand"
                        : "border-line bg-surface-0 hover:border-line-strong hover:bg-surface-1",
                    )}
                  >
                    <input
                      type="radio"
                      name="topic"
                      value={t.value}
                      checked={on}
                      onChange={() => setTopic(t.value)}
                      className="sr-only"
                    />
                    {/* Selected state gets a purple spine — this is us deciding */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "absolute left-0 top-0 h-full w-[3px] transition-opacity duration-fast",
                        on ? "bg-brand-vivid opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex items-center justify-between gap-3">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                        className={cn(
                          "transition-colors duration-fast",
                          on ? "text-brand" : "text-ink-subtle group-hover:text-ink",
                        )}
                      >
                        {t.glyph}
                      </svg>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-full border transition-all duration-fast",
                          on ? "border-brand-vivid bg-brand-vivid" : "border-line-strong",
                        )}
                      >
                        {on && (
                          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="var(--c-brand-on-fill)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m3 8.5 3.2 3.2L13 5" />
                          </svg>
                        )}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "font-display text-headline-sm transition-colors duration-fast",
                        on ? "text-brand-on-soft" : "text-ink",
                      )}
                    >
                      {t.label}
                    </span>
                    <span className="text-body-sm text-ink-muted">{t.blurb}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Step>

        {/* ---------- 02 · Categories ---------- */}
        {showCategories && (
          <Step
            n="02"
            title="Which categories?"
            hint={`Pick up to ${MAX_CATEGORIES}. A focused request gets a better answer.`}
            meta={
              <span
                className={cn(
                  "font-mono text-label-xs tabular-nums",
                  atLimit ? "text-warn" : "text-ink-faint",
                )}
              >
                {selected.length} / {MAX_CATEGORIES}
              </span>
            }
          >
            <fieldset>
              <legend className="sr-only">Related categories</legend>
              <div
                className="grid gap-2.5"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(150px, 100%), 1fr))" }}
              >
                {categories
                  .filter((c) => c.isActive)
                  .map((c) => {
                    const on = selected.includes(c.slug);
                    const blocked = !on && atLimit;
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          "flex select-none items-center gap-3 rounded-md border px-3.5 py-3",
                          "transition-all duration-fast ease-ease",
                          on
                            ? "border-brand-vivid bg-brand-soft text-brand-on-soft"
                            : blocked
                              ? "cursor-not-allowed border-line bg-surface-1 text-ink-faint opacity-55"
                              : "cursor-pointer border-line bg-surface-0 text-ink hover:border-brand-line hover:bg-surface-1",
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={blocked}
                          onChange={() => toggleCategory(c.slug)}
                          className="sr-only"
                        />
                        <CategoryIcon
                          name={c.icon}
                          className={cn("h-5 w-5 shrink-0", on ? "text-brand" : "text-ink-subtle")}
                        />
                        <span className="font-label text-label font-semibold uppercase tracking-[0.05em]">
                          {c.name}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </fieldset>
          </Step>
        )}

        {/* ---------- 03 · Conditional detail ---------- */}
        <Step n={showCategories ? "03" : "02"} title="The details">
          {topic === "research_request" && (
            <Field label="Rough budget" hint="Helps us shortlist realistically.">
              <div className="flex flex-wrap gap-2">
                {BUDGETS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBudget(budget === b ? "" : b)}
                    className={cn(
                      "rounded-full border px-4 py-2 font-label text-label-xs uppercase tracking-[0.08em]",
                      "transition-all duration-fast ease-ease",
                      budget === b
                        ? "border-brand-vivid bg-brand-fill text-brand-on"
                        : "border-line text-ink-muted hover:border-brand hover:text-brand",
                    )}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </Field>
          )}

          {topic === "correction" && (
            <Field label="Which page?" hint="Paste the URL of the product or verdict.">
              <input
                type="url"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://pickdforyou.com/p/audio/…"
                className={inputCls}
              />
            </Field>
          )}

          {topic === "press" && (
            <Field label="Organisation">
              <input
                type="text"
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                placeholder="Company or publication"
                className={inputCls}
              />
            </Field>
          )}

          <Field
            label={
              topic === "research_request"
                ? "What are you trying to buy, and what matters most?"
                : "Tell us more"
            }
            hint={
              topic === "research_request"
                ? "The more specific the use case, the more useful the answer."
                : undefined
            }
            required
          >
            <textarea
              required
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                topic === "research_request"
                  ? "e.g. Headphones for a noisy commute. I take a lot of calls and care more about mic quality than bass."
                  : "Give us the specifics…"
              }
              className={cn(inputCls, "min-h-[150px] resize-y py-3.5 leading-relaxed")}
            />
          </Field>
        </Step>

        {/* ---------- 04 · Contact ---------- */}
        <Step n={showCategories ? "04" : "03"} title="Where do we reply?" last>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional"
                autoComplete="name"
                className={inputCls}
              />
            </Field>
            <Field label="Email" required>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className={inputCls}
              />
            </Field>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand-fill px-9
                         font-label text-label font-semibold uppercase tracking-[0.08em] text-brand-on
                         shadow-brand transition-all duration-fast ease-ease hover:brightness-110
                         disabled:pointer-events-none disabled:opacity-45"
            >
              {state === "loading" ? "Sending…" : "Send request →"}
            </button>
            <p className="text-label-xs leading-relaxed text-ink-faint">
              We reply to real people, not tickets. Never shared, never sold.
            </p>
          </div>

          {error && (
            <p role="alert" className="mt-4 text-body-sm text-danger">
              {error}
            </p>
          )}
        </Step>
      </form>

      {/* ---------- Live request docket ----------
          The signature element: a receipt that assembles as you fill the form.
          Mono, tabular, hairline-ruled — it makes the form read as an
          instrument rather than a web form. */}
      <aside className="lg:sticky lg:top-[calc(var(--nav-h)+var(--subnav-h)+1.5rem)] lg:self-start">
        <div className="panel dot-matrix relative overflow-hidden">
          <span className="absolute left-0 top-0 h-full w-[3px] bg-brand-vivid" aria-hidden="true" />

          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <p className="t-eyebrow text-brand">Request docket</p>
            <span className="rounded-xs border border-line bg-surface-0 px-2 py-0.5 font-mono text-label-xs uppercase tracking-[0.1em] text-ink-faint">
              Draft
            </span>
          </div>

          <dl className="px-6 py-2">
            <DocketRow label="Topic" value={active.label} filled />
            {showCategories && (
              <DocketRow
                label="Categories"
                value={selectedNames.length ? selectedNames.join(", ") : null}
                count={selectedNames.length || undefined}
                filled={selectedNames.length > 0}
              />
            )}
            {topic === "research_request" && (
              <DocketRow label="Budget" value={budget || null} filled={!!budget} />
            )}
            {topic === "correction" && (
              <DocketRow label="Page" value={productUrl || null} filled={!!productUrl} truncate />
            )}
            {topic === "press" && (
              <DocketRow label="Org" value={organisation || null} filled={!!organisation} />
            )}
            <DocketRow
              label="Detail"
              value={message ? `${message.trim().length} characters` : null}
              filled={message.trim().length > 9}
            />
            <DocketRow label="Reply to" value={email || null} filled={email.length > 4} truncate />
          </dl>

          <div className="border-t border-line px-6 py-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="t-eyebrow">Typical reply</span>
              <span className="font-mono text-body-sm tabular-nums text-ink">2–3 days</span>
            </div>
            <p className="mt-3 text-label-xs leading-relaxed text-ink-subtle">
              Research requests take longer — we'd rather answer properly than fast. Brands cannot
              pay to be reviewed, or to change a verdict once written.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

const inputCls =
  "h-14 w-full rounded-md border border-line bg-surface-0 px-4 py-3.5 text-body-md text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";

function Step({
  n,
  title,
  hint,
  meta,
  last,
  children,
}: {
  n: string;
  title: string;
  hint?: string;
  meta?: React.ReactNode;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("relative pl-0 sm:pl-16", !last && "pb-12")}>
      {/* Numbered rail — same motif as the homepage method section */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 hidden h-9 w-9 place-items-center rounded-full border border-line
                   bg-surface-0 font-mono text-label-xs tabular-nums text-brand sm:grid"
      >
        {n}
      </span>
      {!last && (
        <span
          aria-hidden="true"
          className="absolute left-[1.09rem] top-10 hidden h-[calc(100%-2.5rem)] w-px bg-line sm:block"
        />
      )}

      <div className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="font-display text-headline-md text-ink">{title}</h2>
          {hint && <p className="mt-1.5 text-body-sm text-ink-muted">{hint}</p>}
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-6 block first:mt-0">
      <span className="t-eyebrow flex items-center gap-1.5">
        {label}
        {required && <span className="text-brand">*</span>}
      </span>
      {hint && <span className="mt-1 block text-body-sm text-ink-subtle">{hint}</span>}
      <span className="mt-2.5 block">{children}</span>
    </label>
  );
}

function DocketRow({
  label,
  value,
  count,
  filled,
  truncate,
}: {
  label: string;
  value: string | null;
  count?: number;
  filled?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line-faint py-3 last:border-0">
      <dt className="shrink-0 font-mono text-label-xs uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 text-right text-body-sm transition-colors duration-fast",
          filled ? "text-ink" : "text-ink-faint",
          truncate && "truncate",
        )}
      >
        {value ?? "—"}
        {count ? <span className="ml-1.5 font-mono text-label-xs text-brand">({count})</span> : null}
      </dd>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 bg-surface-0 px-4 py-3">
      <dt className="t-eyebrow">{label}</dt>
      <dd className={cn("text-right text-body-sm text-ink", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
