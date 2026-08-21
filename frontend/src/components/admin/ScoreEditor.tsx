"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { ScoreRing } from "@/components/product/ScoreRing";

/**
 * The PickD Score editor (spec §24).
 *
 * This screen was the missing half of publishing. A score is one of the six
 * things `publish_blockers` requires, and nothing in the panel could set one —
 * so "Not ready to publish · missing PickD Score" was a permanent state with no
 * control to resolve it.
 *
 * Criteria come from the **category**, not from here: a headphone is scored on
 * noise cancellation, a monitor on latency, and the API rejects any key the
 * category does not list. So this renders the category's own criteria and
 * offers no way to invent new ones — the constraint is upstream, and a form
 * that let you type a key the server will refuse is a form that lies.
 */
export interface Criterion {
  key: string;
  label: string;
  weight?: number | null;
}

export interface ExistingScore {
  overall: number;
  criteria: { key: string; label: string; value: number; weight?: number | null }[];
}

const MAX = 10;

export function ScoreEditor({
  productId,
  criteria,
  initial,
}: {
  productId: string;
  criteria: Criterion[];
  initial: ExistingScore | null;
}) {
  const router = useRouter();

  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const c of criteria) {
      const found = initial?.criteria.find((x) => x.key === c.key);
      seed[c.key] = found ? String(found.value) : "";
    }
    return seed;
  });

  const [overall, setOverall] = useState(() =>
    initial ? String(initial.overall) : "",
  );
  // Follow the criteria unless an editor has deliberately overridden the
  // number. An average is a good default and a bad mandate — the whole point
  // of a PickD Score is that a human can disagree with the arithmetic.
  const [manual, setManual] = useState(() => Boolean(initial));

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scored = useMemo(
    () =>
      criteria
        .map((c) => ({ c, n: Number(values[c.key]) }))
        .filter(({ c, n }) => values[c.key]?.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= MAX && c),
    [criteria, values],
  );

  const average = useMemo(() => {
    if (scored.length === 0) return null;
    const totalWeight = scored.reduce((sum, { c }) => sum + (c.weight ?? 1), 0);
    if (totalWeight <= 0) return null;
    const weighted = scored.reduce((sum, { c, n }) => sum + n * (c.weight ?? 1), 0);
    return Math.round((weighted / totalWeight) * 10) / 10;
  }, [scored]);

  const effectiveOverall = manual ? Number(overall) : average;
  const overallValid =
    effectiveOverall !== null &&
    Number.isFinite(effectiveOverall) &&
    effectiveOverall >= 0 &&
    effectiveOverall <= MAX;

  function setCriterion(key: string, raw: string) {
    setValues((prev) => ({ ...prev, [key]: raw }));
    setSaved(false);
  }

  async function save() {
    if (!overallValid) {
      setError(`Give an overall score between 0 and ${MAX}.`);
      return;
    }
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/admin/api/products/${productId}/score`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overall: effectiveOverall,
          criteria: scored.map(({ c, n }) => ({
            key: c.key,
            label: c.label,
            value: n,
            weight: c.weight ?? null,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const detail = body?.detail;
        // The API names the criteria it refused, which is the one thing worth
        // showing — "could not save" would send an editor hunting.
        const unknown = detail?.unknown as string[] | undefined;
        setError(
          unknown?.length
            ? `Not scoring criteria for this category: ${unknown.join(", ")}`
            : typeof detail === "string"
              ? detail
              : (detail?.message as string | undefined) ?? "Could not save the score.",
        );
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not save the score. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {criteria.length === 0 && (
        <p className="mb-5 rounded-md border border-line bg-surface-1 px-4 py-3 text-body-sm text-ink-muted">
          This category has no scoring criteria configured, so only the overall
          score applies. Criteria are seeded per category — see{" "}
          <code className="font-mono text-ink">supabase/seed.sql</code>.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid gap-3">
          {criteria.map((c) => {
            const raw = values[c.key] ?? "";
            const n = Number(raw);
            const bad = raw.trim() !== "" && (!Number.isFinite(n) || n < 0 || n > MAX);
            return (
              <label key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                <span className="min-w-0">
                  <span className="block truncate text-body-sm text-ink">{c.label}</span>
                  <span className="block font-mono text-[10px] text-ink-faint">{c.key}</span>
                </span>
                <span className="flex items-center gap-3">
                  {/* The slider is the fast path; the number is the precise
                      one. Both write the same value, so neither is a fallback. */}
                  <input
                    type="range"
                    min={0}
                    max={MAX}
                    step={0.1}
                    value={Number.isFinite(n) && raw !== "" ? n : 0}
                    onChange={(e) => setCriterion(c.key, e.target.value)}
                    aria-label={`${c.label} score`}
                    className="w-40 accent-[var(--c-brand-fill)]"
                  />
                  <input
                    type="number"
                    min={0}
                    max={MAX}
                    step={0.1}
                    value={raw}
                    onChange={(e) => setCriterion(c.key, e.target.value)}
                    placeholder="—"
                    aria-label={`${c.label} score, exact`}
                    className={cn(
                      "tabular h-9 w-20 rounded-md border bg-surface-0 px-2 text-center text-body-sm",
                      "text-ink outline-none transition-colors duration-fast focus:border-brand-vivid",
                      bad ? "border-danger" : "border-line",
                    )}
                  />
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3 rounded-lg border border-line bg-surface-1 p-5">
          <span className="t-eyebrow">Overall</span>
          {overallValid ? (
            <ScoreRing score={effectiveOverall} size="md" showLabel={false} />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full border border-dashed border-line text-ink-faint">
              —
            </span>
          )}
          <label className="flex items-center gap-2 text-label-xs text-ink-subtle">
            <input
              type="checkbox"
              checked={manual}
              onChange={(e) => {
                setManual(e.target.checked);
                if (e.target.checked && overall === "" && average !== null) {
                  setOverall(String(average));
                }
                setSaved(false);
              }}
              className="h-3.5 w-3.5 accent-[var(--c-brand-fill)]"
            />
            Set by hand
          </label>
          <input
            type="number"
            min={0}
            max={MAX}
            step={0.1}
            disabled={!manual}
            value={manual ? overall : average === null ? "" : String(average)}
            onChange={(e) => {
              setOverall(e.target.value);
              setSaved(false);
            }}
            aria-label="Overall score"
            className="tabular h-10 w-24 rounded-md border border-line bg-surface-0 px-2 text-center
                       text-body-md text-ink outline-none transition-colors duration-fast
                       focus:border-brand-vivid disabled:opacity-55"
          />
          <span className="text-center text-[10px] leading-tight text-ink-faint">
            {manual ? "Independent of the criteria" : "Weighted average of the criteria"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-line pt-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !overallValid}
          className="inline-flex h-10 items-center rounded-full border border-line-strong px-6
                     font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink
                     transition-colors duration-fast hover:border-brand hover:text-brand
                     disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Saving…" : "Save score"}
        </button>
        {error ? (
          <span role="alert" className="text-body-sm text-danger">
            {error}
          </span>
        ) : saved ? (
          <span className="text-body-sm text-value">Saved.</span>
        ) : (
          <span className="text-label-xs text-ink-faint">
            A score is required to publish (spec §62).
          </span>
        )}
      </div>
    </div>
  );
}
