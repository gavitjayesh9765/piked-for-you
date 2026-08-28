"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { fileSize, type LibraryAsset } from "@/components/admin/MediaPicker";

/**
 * The media library grid, with delete.
 *
 * ---------------------------------------------------------------------------
 * WHY DELETE HERE IS A DIFFERENT VERB FROM DELETE ON A PRODUCT
 *
 * On a product page, ✕ means "take this off this product" — the file survives
 * if anything else still points at it. Here the subject is the *file*, so
 * deleting removes it from every product at once and empties it out of the
 * bucket. There is no undo and no bin.
 *
 * That is a genuinely destructive action on content that may be live, so it is
 * not a bare ✕ on a tile. Selection is explicit, and the confirmation names
 * every product that will lose an image — a count is not enough, because
 * "3 products" does not tell you whether one of them is the thing on the
 * homepage.
 *
 * ---------------------------------------------------------------------------
 * The grid is seeded from the server render and then owns its own copy, so a
 * delete removes the tile immediately instead of waiting on a round trip.
 * `router.refresh()` still runs afterwards to bring the counts and any
 * concurrent edit back into line — and the effect below re-seeds from the
 * server whenever that lands, which a plain `useState(initial)` would not do.
 */
export function MediaGrid({
  initial,
  seed,
}: {
  initial: LibraryAsset[];
  /**
   * Changes whenever the server sends a genuinely different page — the filter,
   * the query, the page number. Without it, paging from page 1 to page 2 would
   * leave page 1's tiles on screen: `useState` ignores every prop after the
   * first render, which is the bug this component is written to avoid.
   */
  seed: string;
}) {
  const router = useRouter();
  const [assets, setAssets] = useState(initial);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed on a real server change. Keyed on `seed` rather than on `initial`,
  // because `initial` is a fresh array on every render and would loop.
  useEffect(() => {
    setAssets(initial);
    setChosen(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  function toggle(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selected = assets.filter((a) => chosen.has(a.id));
  // Every product that loses an image if this goes ahead, named once.
  const affected = Array.from(
    new Map(
      selected.flatMap((a) => a.usedBy.map((u) => [u.productId, u] as const)),
    ).values(),
  );

  async function destroy() {
    setBusy(true);
    setError(null);

    const removed: string[] = [];
    for (const asset of selected) {
      try {
        const res = await fetch(`/admin/api/media/library/${asset.id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const detail = (body as { detail?: unknown })?.detail;
          setError(typeof detail === "string" ? detail : "One file could not be deleted.");
          break;
        }
        removed.push(asset.id);
      } catch {
        setError("Lost the connection part way through.");
        break;
      }
    }

    setAssets((prev) => prev.filter((a) => !removed.includes(a.id)));
    setChosen(new Set());
    setBusy(false);
    setConfirming(false);
    router.refresh();
  }

  if (assets.length === 0) {
    return (
      <div className="dot-matrix rounded-lg border border-line py-16 text-center">
        <p className="text-body-md text-ink-muted">Nothing here.</p>
      </div>
    );
  }

  return (
    <div>
      {/* --- Selection bar. Present at all times so the affordance is not a
              secret, but only actionable once something is chosen. --- */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="tabular text-body-sm text-ink-subtle">
          {chosen.size > 0
            ? `${chosen.size} selected`
            : "Select a file to delete it."}
        </p>
        <span className="flex items-center gap-2">
          {chosen.size > 0 && (
            <button
              type="button"
              onClick={() => setChosen(new Set())}
              className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-ink"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            disabled={chosen.size === 0}
            onClick={() => setConfirming(true)}
            className="inline-flex h-9 items-center rounded-full border border-danger-line px-4 font-label
                       text-label-xs font-semibold uppercase tracking-[0.08em] text-danger
                       transition-colors duration-fast hover:bg-danger-soft
                       disabled:pointer-events-none disabled:opacity-30"
          >
            Delete{chosen.size > 0 ? ` ${chosen.size}` : ""}
          </button>
        </span>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-danger-soft bg-danger-soft px-4 py-2.5 text-body-sm text-danger-on-soft">
          {error}
        </p>
      )}

      <ul
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(170px, 100%), 1fr))" }}
      >
        {assets.map((m) => {
          const on = chosen.has(m.id);
          return (
            <li
              key={m.id}
              className={cn(
                "panel overflow-hidden transition-all duration-fast",
                on && "border-danger ring-2 ring-danger",
              )}
            >
              <div className="plate relative aspect-square">
                {m.thumbnailUrl ? (
                  <Image
                    src={m.thumbnailUrl}
                    alt={m.alt ?? ""}
                    fill
                    sizes="200px"
                    className={m.kind === "video_link" ? "object-cover" : "object-contain p-2"}
                  />
                ) : (
                  <div className="dot-matrix h-full w-full" />
                )}

                {m.kind === "video_link" && (
                  <span className="absolute left-2 top-2 rounded-xs bg-editorial-bg px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.1em] text-editorial-fg">
                    {m.provider}
                  </span>
                )}

                {/* Shared files are the ones where a delete is expensive, so
                    the count is on the tile rather than only in the dialog. */}
                {m.usageCount > 1 && (
                  <span
                    title={m.usedBy.map((u) => u.productTitle).join(", ")}
                    className="absolute bottom-2 left-2 rounded-xs bg-brand-fill px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.1em] text-brand-on"
                  >
                    {m.usageCount} products
                  </span>
                )}

                {/* A real checkbox, not a div with a click handler: it is
                    reachable by keyboard and announced as selected. */}
                <label
                  className="absolute right-2 top-2 grid h-6 w-6 cursor-pointer place-items-center
                             rounded-xs border border-line bg-surface-0/90 backdrop-blur-sm"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(m.id)}
                    aria-label={`Select ${m.productTitle}`}
                    className="h-3.5 w-3.5 accent-[var(--c-danger)]"
                  />
                </label>
              </div>

              <div className="border-t border-line px-3 py-2">
                <Link
                  href={`/admin/products/${m.productId}`}
                  className="block truncate text-body-sm text-ink hover:text-brand"
                >
                  {m.productTitle}
                </Link>
                <span className="font-mono text-[10px] text-ink-faint">
                  {m.kind === "video_link"
                    ? "linked"
                    : `${m.width ?? "?"}×${m.height ?? "?"} · ${fileSize(m.sizeBytes)}`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {confirming && (
        <ConfirmDelete
          files={selected.length}
          affected={affected}
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void destroy()}
        />
      )}
    </div>
  );
}

/**
 * The confirmation.
 *
 * It names products rather than counting them. A file used by three products
 * is a different decision depending on which three, and that is exactly the
 * information a count throws away.
 */
function ConfirmDelete({
  files,
  affected,
  busy,
  onCancel,
  onConfirm,
}: {
  files: number;
  affected: { productId: string; productTitle: string }[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, busy]);

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      className="fixed inset-0 z-modal grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-line bg-surface-0 shadow-e3"
      >
        <div className="px-6 py-5">
          <h2 id="confirm-delete-title" className="font-display text-headline-sm text-ink">
            Delete {files} {files === 1 ? "file" : "files"}?
          </h2>
          <p className="mt-2 text-body-sm text-ink-muted">
            The {files === 1 ? "file is" : "files are"} removed from storage and from every
            product using {files === 1 ? "it" : "them"}. This cannot be undone.
          </p>

          {affected.length > 0 && (
            <>
              <p className="mt-5 t-eyebrow">
                {affected.length} {affected.length === 1 ? "product loses" : "products lose"} an image
              </p>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-md border border-line bg-surface-1 px-4 py-3">
                {affected.map((p) => (
                  <li key={p.productId} className="truncate text-body-sm text-ink">
                    {p.productTitle}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-1 px-6 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-10 items-center rounded-full border border-line-strong px-4
                       font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink
                       transition-colors duration-fast hover:border-brand hover:text-brand
                       disabled:pointer-events-none disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-10 items-center rounded-full bg-danger-fill px-5 font-label
                       text-label-xs font-semibold uppercase tracking-[0.08em] text-danger-on
                       transition-all duration-fast hover:brightness-110
                       disabled:pointer-events-none disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}
