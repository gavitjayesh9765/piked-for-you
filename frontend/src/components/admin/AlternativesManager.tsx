"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { formatPrice } from "@/lib/format";
import type { AlternativePick, AlternativeReason, ProductSummary } from "@/lib/types";

/**
 * Curated alternatives (spec §52).
 *
 * The block at the bottom of a product page used to be filled entirely by a
 * price-band heuristic: same category, within ±60% of the price, best score
 * first. That can find neighbours. It cannot say *why* a reader might want one
 * — and under a SKIP or CONSIDER AN ALTERNATIVE verdict, "why" is the only
 * part that matters, because the page has just told someone not to buy and
 * owes them somewhere to go.
 *
 * So the reason is authored here. Whatever an editor does not fill, the
 * heuristic still tops up, and the public page labels the two differently.
 *
 * Three deliberate behaviours:
 *
 *  - **Search covers drafts.** Alternatives get lined up before their own
 *    pages are live. The public endpoint filters unpublished targets out at
 *    read time, so a draft pick is stored and simply does not render yet.
 *  - **Order is the list order.** Editors reorder with the arrows rather than
 *    maintaining a number, and the array index becomes `display_order` on
 *    save.
 *  - **Save replaces the set.** Same contract as retailer links. These rows
 *    own no history, so there is nothing to preserve by merging.
 */

const REASONS: { value: AlternativeReason; label: string; hint: string }[] = [
  { value: "better_value", label: "Better value", hint: "More of what matters per rupee." },
  { value: "better_performance", label: "Better performance", hint: "Straightforwardly faster or better at the job." },
  { value: "better_budget", label: "Better budget option", hint: "Cheaper, and gives up little that matters." },
  { value: "better_for_professionals", label: "Better for professionals", hint: "The one to buy if this is a tool you use all day." },
  { value: "better_features", label: "More features", hint: "Does things this one cannot." },
  { value: "closest_rival", label: "Closest rival", hint: "The direct comparison a reader will already be making." },
];

type Row = {
  id: string;
  title: string;
  brand: string;
  status: string;
  price: string;
  reason: AlternativeReason;
  note: string;
};

function toRow(a: AlternativePick): Row {
  return {
    id: a.id,
    title: a.title,
    brand: a.brand.name,
    status: a.status,
    price: formatPrice(a.pricing.current, a.pricing.currency),
    reason: a.reason,
    note: a.note ?? "",
  };
}

export function AlternativesManager({
  productId,
  initial,
}: {
  productId: string;
  initial: AlternativePick[];
}) {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  function remove(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSaved(false);
  }

  function move(index: number, delta: number) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  function add(product: ProductSummary) {
    setRows((prev) =>
      prev.some((r) => r.id === product.id)
        ? prev
        : [
            ...prev,
            {
              id: product.id,
              title: product.title,
              brand: product.brand.name,
              status: product.status,
              price: formatPrice(product.pricing.current, product.pricing.currency),
              // Not defaulted to "better_value": an unconsidered default is
              // how a claim nobody made ends up on a public page.
              reason: "closest_rival",
              note: "",
            },
          ],
    );
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/products/${productId}/alternatives`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: rows.map((r) => ({
            alternativeId: r.id,
            reason: r.reason,
            note: r.note.trim() || null,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const d = body?.detail;
        setError(typeof d === "string" ? d : "Could not save the alternatives.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not save the alternatives.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-body-sm text-ink-muted">
          Nothing curated yet. The product page will fall back to similar products at a similar
          price, labelled as such — which is honest, but it cannot tell anyone why.
        </p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r, i) => (
            <li key={r.id} className="rounded-md border border-line bg-surface-0 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="tabular font-mono text-label-xs text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate font-label text-label font-semibold uppercase tracking-[0.06em] text-ink">
                    {r.brand} {r.title}
                  </span>
                  <span className="tabular shrink-0 text-body-sm text-ink-subtle">{r.price}</span>
                  {r.status !== "published" && (
                    <span
                      className="shrink-0 rounded-xs border border-warn-line bg-warn-soft px-2 py-0.5
                                 font-label text-label-xs uppercase tracking-[0.1em] text-warn-on-soft"
                      title="Stored, but hidden on the public page until this product is published."
                    >
                      {r.status}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <IconButton label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </IconButton>
                  <IconButton
                    label="Move down"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </IconButton>
                  <IconButton label="Remove" onClick={() => remove(r.id)} tone="danger">
                    ×
                  </IconButton>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                <label className="block">
                  <span className="t-eyebrow">Why this one</span>
                  <select
                    value={r.reason}
                    onChange={(e) =>
                      update(r.id, { reason: e.target.value as AlternativeReason })
                    }
                    className={cn(field, "mt-2")}
                  >
                    {REASONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="t-eyebrow">Note (optional)</span>
                  <input
                    maxLength={200}
                    value={r.note}
                    onChange={(e) => update(r.id, { note: e.target.value })}
                    placeholder={REASONS.find((o) => o.value === r.reason)?.hint}
                    className={cn(field, "mt-2")}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProductPicker onPick={add} exclude={[productId, ...rows.map((r) => r.id)]} />

      <div className="mt-5 flex items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-10 items-center rounded-full bg-brand-fill px-6 font-label
                     text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                     transition-all duration-fast hover:brightness-110
                     disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Saving…" : "Save alternatives"}
        </button>
        {error ? (
          <p role="alert" className="text-body-sm text-danger">
            {error}
          </p>
        ) : saved ? (
          <p className="text-body-sm text-value">Saved.</p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Type-to-search across the catalogue, drafts included.
 *
 * Debounced, and every in-flight request is abandoned when a newer keystroke
 * arrives — without that, a slow response for "so" can land after the response
 * for "sony" and replace it with staler results.
 */
function ProductPicker({
  onPick,
  exclude,
}: {
  onPick: (p: ProductSummary) => void;
  exclude: string[];
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setSearching(true);
      try {
        const res = await fetch(
          `/admin/api/products/search?q=${encodeURIComponent(term)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const body = await res.json();
        setResults((body?.items ?? []) as ProductSummary[]);
      } catch {
        // An aborted request is the normal case here, not an error worth
        // surfacing — the next keystroke's results are already on their way.
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [q]);

  const visible = results.filter((p) => !exclude.includes(p.id));

  return (
    <div className="mt-5 rounded-md border border-dashed border-line p-4">
      <label className="block">
        <span className="t-eyebrow">Add an alternative</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search the catalogue by title or brand…"
          className={cn(field, "mt-2")}
        />
      </label>

      {q.trim().length >= 2 && (
        <div className="mt-3">
          {searching && visible.length === 0 ? (
            <p className="text-body-sm text-ink-subtle">Searching…</p>
          ) : visible.length === 0 ? (
            <p className="text-body-sm text-ink-subtle">
              Nothing else matches. Products already on the list are hidden here.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {visible.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(p);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between gap-4 rounded-md border
                               border-transparent px-3 py-2 text-left transition-colors duration-fast
                               hover:border-line hover:bg-surface-1"
                  >
                    <span className="min-w-0 truncate text-body-sm text-ink">
                      {p.brand.name} {p.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <span className="tabular text-body-sm text-ink-subtle">
                        {formatPrice(p.pricing.current, p.pricing.currency)}
                      </span>
                      {p.status !== "published" && (
                        <span className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
                          {p.status}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-md border border-line text-body-sm",
        "transition-colors duration-fast disabled:pointer-events-none disabled:opacity-35",
        tone === "danger"
          ? "text-ink-subtle hover:border-danger hover:text-danger"
          : "text-ink-subtle hover:border-brand hover:text-brand",
      )}
    >
      {children}
    </button>
  );
}

const field =
  "h-10 w-full rounded-md border border-line bg-surface-1 px-3 text-body-sm text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";
