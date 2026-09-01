"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import type { Brand, Category } from "@/lib/types";
import type { Preferences } from "@/lib/me-api";

const MAX_CATEGORIES = 12;
const MAX_BRANDS = 20;

const BUDGETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Any", min: null, max: null },
  { label: "Under ₹5,000", min: null, max: 5000 },
  { label: "₹5,000 – ₹15,000", min: 5000, max: 15000 },
  { label: "₹15,000 – ₹30,000", min: 15000, max: 30000 },
  { label: "₹30,000 – ₹75,000", min: 30000, max: 75000 },
  { label: "Above ₹75,000", min: 75000, max: null },
];

/**
 * Interests and budget.
 *
 * This is the input to "Picked for you". We recommend from what someone
 * **explicitly tells us** — not from what they browsed. That is a deliberate
 * product choice: a research site that quietly profiles its readers is not the
 * trustworthy thing it claims to be, and the copy says as much.
 *
 * Notification toggles default OFF. Consent is given, never assumed.
 */
export function PreferencesForm({
  categories,
  brands,
  initial,
}: {
  categories: Category[];
  brands: Brand[];
  initial: Preferences;
}) {
  const router = useRouter();

  const [categoryIds, setCategoryIds] = useState<string[]>(initial.categoryIds ?? []);
  const [brandIds, setBrandIds] = useState<string[]>(initial.brandIds ?? []);
  const [budgetIndex, setBudgetIndex] = useState(() =>
    Math.max(
      0,
      BUDGETS.findIndex((b) => b.min === initial.budgetMin && b.max === initial.budgetMax),
    ),
  );
  const [useCase, setUseCase] = useState(initial.useCase ?? "");
  const [notifyPriceDrops, setNotifyPriceDrops] = useState(initial.notifyPriceDrops);
  const [notifyNewPicks, setNotifyNewPicks] = useState(initial.notifyNewPicks);

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(list: string[], set: (v: string[]) => void, id: string, max: number) {
    setSaved(false);
    if (list.includes(id)) set(list.filter((x) => x !== id));
    else if (list.length < max) set([...list, id]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const budget = BUDGETS[budgetIndex];

    try {
      const res = await fetch("/api/me/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryIds,
          brandIds,
          budgetMin: budget.min,
          budgetMax: budget.max,
          useCase: useCase.trim() || null,
          notifyPriceDrops,
          notifyNewPicks,
        }),
      });
      if (!res.ok) {
        setError("Could not save. Try again.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      {/* --- Categories --- */}
      <Block
        n="01"
        title="What are you shopping for?"
        hint={`Pick the categories you care about. Up to ${MAX_CATEGORIES}.`}
        meta={
          <span className="font-mono text-label-xs tabular-nums text-ink-faint">
            {categoryIds.length} / {MAX_CATEGORIES}
          </span>
        }
      >
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(150px, 100%), 1fr))" }}
        >
          {categories.map((c) => {
            const on = categoryIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(categoryIds, setCategoryIds, c.id, MAX_CATEGORIES)}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-3.5 py-3 text-left",
                  "transition-all duration-fast ease-ease",
                  on
                    ? "border-brand-vivid bg-brand-soft text-brand-on-soft"
                    : "border-line bg-surface-0 text-ink hover:border-brand-line hover:bg-surface-1",
                )}
              >
                <CategoryIcon
                  name={c.icon}
                  className={cn("h-5 w-5 shrink-0", on ? "text-brand" : "text-ink-subtle")}
                />
                <span className="font-label text-label font-semibold uppercase tracking-[0.05em]">
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </Block>

      {/* --- Brands --- */}
      <Block
        n="02"
        title="Any brands you prefer?"
        hint="Optional. Leave blank and we'll consider everything."
        meta={
          <span className="font-mono text-label-xs tabular-nums text-ink-faint">
            {brandIds.length} / {MAX_BRANDS}
          </span>
        }
      >
        <div className="flex flex-wrap gap-2">
          {brands.map((b) => {
            const on = brandIds.includes(b.id);
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggle(brandIds, setBrandIds, b.id, MAX_BRANDS)}
                className={cn(
                  "rounded-full border px-4 py-2 font-label text-label-xs font-semibold uppercase",
                  "tracking-[0.08em] transition-all duration-fast",
                  on
                    ? "border-brand-vivid bg-brand-fill text-brand-on"
                    : "border-line text-ink-muted hover:border-brand hover:text-brand",
                )}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      </Block>

      {/* --- Budget --- */}
      <Block n="03" title="Budget" hint="So recommendations are realistic, not aspirational.">
        <div className="flex flex-wrap gap-2">
          {BUDGETS.map((b, i) => (
            <button
              key={b.label}
              type="button"
              onClick={() => {
                setBudgetIndex(i);
                setSaved(false);
              }}
              className={cn(
                "rounded-full border px-4 py-2 font-label text-label-xs font-semibold uppercase",
                "tracking-[0.08em] transition-all duration-fast",
                budgetIndex === i
                  ? "border-brand-vivid bg-brand-fill text-brand-on"
                  : "border-line text-ink-muted hover:border-brand hover:text-brand",
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
      </Block>

      {/* --- Use case --- */}
      <Block
        n="04"
        title="Anything else we should know?"
        hint="The more specific, the better the match."
      >
        <textarea
          rows={4}
          maxLength={1000}
          value={useCase}
          onChange={(e) => {
            setUseCase(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. I take a lot of calls and commute daily. Mic quality matters more to me than bass."
          className="w-full resize-y rounded-md border border-line bg-surface-0 px-4 py-3
                     text-body-md leading-relaxed text-ink outline-none transition-colors
                     duration-fast placeholder:text-ink-faint focus:border-brand-vivid"
        />
      </Block>

      {/* --- Notifications --- */}
      <Block n="05" title="Email me when" hint="Both off by default. We only send what you ask for.">
        <div className="grid gap-3">
          <Toggle
            checked={notifyPriceDrops}
            onChange={(v) => {
              setNotifyPriceDrops(v);
              setSaved(false);
            }}
            label="A product I saved drops in price"
            /* Says how the promise is actually kept. The drop is measured from
               the price on the day you saved it — not from a peak — and it
               arrives when a person next checks, because nothing here checks a
               price on a timer. A reader who expects a tracker and gets an
               occasional email should have been told which one this is. */
            hint="Measured from the price when you saved it, and only for a meaningful fall. We check by hand, so it arrives when we next look."
          />
          <Toggle
            checked={notifyNewPicks}
            onChange={(v) => {
              setNotifyNewPicks(v);
              setSaved(false);
            }}
            label="We publish a new pick in my categories"
            /* Says what happens when no categories are chosen, because that is
               the state most people who turn this on are actually in — and
               reading it the other way would make the toggle silently do
               nothing for them. */
            hint="One email when a verdict is published. Pick categories above to narrow it; leave them empty and you hear about all of them."
          />
        </div>
      </Block>

      <div className="sticky bottom-0 -mx-1 mt-8 flex items-center justify-between gap-4 border-t border-line bg-bg/95 py-5 backdrop-blur-md">
        <p className="text-label-xs text-ink-faint">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : saved ? (
            <span className="text-value">Saved.</span>
          ) : (
            "We recommend from what you tell us — never from what you browse."
          )}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 shrink-0 items-center rounded-full bg-brand-fill px-8
                     font-label text-label-xs font-semibold uppercase tracking-[0.08em]
                     text-brand-on shadow-brand transition-all duration-fast hover:brightness-110
                     disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </form>
  );
}

function Block({
  n,
  title,
  hint,
  meta,
  children,
}: {
  n: string;
  title: string;
  hint?: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-baseline gap-4">
          <span className="font-mono text-label-xs tabular-nums text-brand">{n}</span>
          <div>
            <h2 className="font-display text-headline-sm text-ink">{title}</h2>
            {hint && <p className="mt-1 text-body-sm text-ink-muted">{hint}</p>}
          </div>
        </div>
        {meta}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors duration-fast",
        checked ? "border-brand-line bg-brand-soft" : "border-line bg-surface-0 hover:bg-surface-1",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--c-brand-fill)]"
      />
      <span>
        <span className={cn("block text-body-sm font-medium", checked ? "text-brand-on-soft" : "text-ink")}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-label-xs text-ink-subtle">{hint}</span>}
      </span>
    </label>
  );
}
