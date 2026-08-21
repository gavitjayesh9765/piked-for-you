"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/pricing";
import { ScrapeStatusChip } from "@/components/admin/pricing/StatusChip";
import type { RetailerLink } from "@/lib/types";

/**
 * Retailer links (spec §26).
 *
 * One row per configured retailer — Amazon, Flipkart, the brand's own Official
 * store, and whatever is added next. The list is built from the `retailers`
 * table rather than hard-coded, so adding a fourth is an INSERT and this form
 * grows a row on its own.
 *
 * At least one active link is required to publish (spec §62) — a research page
 * that tells you what to buy but not where to get it is unfinished.
 *
 * The URL is validated server-side too (http/https only). Anything else would
 * be rendered into an anchor that real visitors click.
 */
export function RetailerLinks({
  productId,
  retailers,
  initial,
}: {
  productId: string;
  retailers: { id: string; name: string; slug: string }[];
  initial: RetailerLink[];
}) {
  const router = useRouter();

  const [rows, setRows] = useState(() =>
    retailers.map((r) => {
      const existing = initial.find((l) => l.retailerSlug === r.slug);
      return {
        retailerId: r.id,
        name: r.name,
        slug: r.slug,
        url: existing?.url ?? "",
        displayPrice: existing?.displayPrice?.toString() ?? "",
        isActive: existing?.isActive ?? true,
        scrapeEnabled: existing?.scrapeEnabled ?? true,
        // Read-only state written by the price runs. Kept beside the fields it
        // explains, because "this price is four weeks old" is only useful next
        // to the price itself.
        lastScrapeStatus: existing?.lastScrapeStatus ?? null,
        lastScrapeError: existing?.lastScrapeError ?? null,
        lastScrapedAt: existing?.lastScrapedAt ?? null,
        lastUpdatedAt: existing?.lastUpdatedAt ?? null,
        inStock: existing?.inStock ?? null,
      };
    }),
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const payload = rows
      .filter((r) => r.url.trim())
      .map((r) => ({
        retailerId: r.retailerId,
        url: r.url.trim(),
        displayPrice: r.displayPrice.trim() ? Number(r.displayPrice) : null,
        isActive: r.isActive,
        scrapeEnabled: r.scrapeEnabled,
      }));

    try {
      const res = await fetch(`/admin/api/products/${productId}/retailers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const d = body?.detail;
        setError(typeof d === "string" ? d : "Could not save the links.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Could not save the links.");
    } finally {
      setBusy(false);
    }
  }

  if (retailers.length === 0) {
    return (
      <p className="text-body-sm text-ink-muted">
        No retailers configured. Add rows to the <code className="font-mono text-ink">retailers</code>{" "}
        table first.
      </p>
    );
  }

  return (
    <div>
      <div className="grid gap-4">
        {rows.map((r, i) => (
          <div key={r.retailerId} className="rounded-md border border-line bg-surface-0 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-label text-label font-semibold uppercase tracking-[0.06em] text-ink">
                  {r.name}
                </span>
                {r.lastScrapeStatus && <ScrapeStatusChip status={r.lastScrapeStatus} />}
                {r.inStock === false && (
                  <span className="font-label text-label-xs uppercase tracking-[0.08em] text-warn-on-soft">
                    Out of stock
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-label-xs text-ink-subtle">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={(e) => update(i, { isActive: e.target.checked })}
                    className="h-3.5 w-3.5 accent-[var(--c-brand-fill)]"
                  />
                  Active
                </label>
                <label
                  className="flex cursor-pointer items-center gap-2 text-label-xs text-ink-subtle"
                  title="Include this link when prices are refreshed."
                >
                  <input
                    type="checkbox"
                    checked={r.scrapeEnabled}
                    onChange={(e) => update(i, { scrapeEnabled: e.target.checked })}
                    className="h-3.5 w-3.5 accent-[var(--c-brand-fill)]"
                  />
                  Check price
                </label>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
              <input
                type="url"
                value={r.url}
                onChange={(e) => update(i, { url: e.target.value })}
                placeholder={
                  r.slug === "official"
                    ? "https://www.brand.com/products/…"
                    : `https://www.${r.slug}.in/dp/…`
                }
                className="h-10 w-full rounded-md border border-line bg-surface-1 px-3 font-mono
                           text-body-sm text-ink outline-none transition-colors duration-fast
                           placeholder:text-ink-faint focus:border-brand-vivid"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={r.displayPrice}
                onChange={(e) => update(i, { displayPrice: e.target.value })}
                placeholder="Price shown"
                className="tabular h-10 w-full rounded-md border border-line bg-surface-1 px-3
                           text-body-sm text-ink outline-none transition-colors duration-fast
                           placeholder:text-ink-faint focus:border-brand-vivid"
              />
            </div>

            {(r.lastScrapedAt || r.lastUpdatedAt) && (
              <p className="mt-2 text-label-xs text-ink-faint">
                Price {timeAgo(r.lastUpdatedAt)}
                {r.lastScrapedAt && ` · last checked ${timeAgo(r.lastScrapedAt)}`}
              </p>
            )}

            {/* The error is shown in full rather than truncated: it is written
                upstream to say what to do about it, and half of that sentence
                is no use to anyone. */}
            {r.lastScrapeError && (
              <p className="mt-2 rounded-sm border border-line bg-surface-2 px-3 py-2 text-label-xs leading-relaxed text-ink-muted">
                {r.lastScrapeError}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className={cn(
            "inline-flex h-10 items-center rounded-full border border-line-strong px-6",
            "font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink",
            "transition-colors duration-fast hover:border-brand hover:text-brand",
            "disabled:pointer-events-none disabled:opacity-45",
          )}
        >
          {busy ? "Saving…" : "Save links"}
        </button>
        {error ? (
          <span role="alert" className="text-body-sm text-danger">
            {error}
          </span>
        ) : saved ? (
          <span className="text-body-sm text-value">Saved.</span>
        ) : (
          <span className="text-label-xs text-ink-faint">
            At least one active link is required to publish.
          </span>
        )}
      </div>
    </div>
  );
}
