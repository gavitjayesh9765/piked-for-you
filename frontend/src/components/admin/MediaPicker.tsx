"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * One file in the library, with every product currently using it.
 *
 * Note this is a *file*, not an attachment: the API groups `product_media`
 * rows by the object they point at, so a photograph used on three products is
 * one entry here with `usageCount: 3`.
 */
export interface LibraryAsset {
  id: string;
  kind: string;
  url: string;
  thumbnailUrl: string;
  provider: string | null;
  alt: string | null;
  productId: string;
  productTitle: string;
  usedBy: { productId: string; productTitle: string }[];
  usageCount: number;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
}

export function fileSize(bytes: number | null) {
  if (!bytes) return "—";
  return bytes > 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Choose images from the library instead of uploading them again.
 *
 * This is the other half of de-duplication. The upload path already collapses
 * two uploads of the same photograph into one object by hashing the bytes it
 * stores — but that only helps someone who still has the file. Far more often
 * the image is *already here*, on another product, and the only route to it
 * was to find it, download it and upload it back. So the bucket grew, and the
 * library filled with the same picture over and over.
 *
 * Picking here writes a row that points at the existing object. Nothing is
 * uploaded and nothing is copied.
 *
 * Deliberately multi-select: the reason to open this is usually "the four
 * photos I just put on the previous variant", and doing that one modal at a
 * time is the kind of small tax that stops people using the feature at all.
 */
export function MediaPicker({
  productId,
  onClose,
  onAttached,
}: {
  productId: string;
  onClose: () => void;
  /** Called once per successful attach, so the caller can append a tile. */
  onAttached: (media: unknown) => void;
}) {
  const [query, setQuery] = useState("");
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  // Escape closes, and the click that opened this must not also close it —
  // hence the backdrop's own handler checking the target.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    // The page behind must not scroll under an open modal.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Search-as-you-type, debounced, and aborted on every keystroke — otherwise
  // a slow response for "ph" can land after the one for "phone" and overwrite
  // it with the wrong results.
  useEffect(() => {
    const controller = new AbortController();
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ kind: "image" });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/admin/api/media?${params}`, { signal: controller.signal });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { items?: LibraryAsset[] };
        setAssets(Array.isArray(body.items) ? body.items : []);
        setError(null);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") setError("Could not load the library.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, query ? 250 : 0);

    return () => {
      clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  const toggle = useCallback((id: string) => {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function attach() {
    setBusy(true);
    setError(null);
    setDone(0);

    let attached = 0;
    for (const mediaId of chosen) {
      try {
        const res = await fetch(`/admin/api/products/${productId}/media/attach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mediaId }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const detail = (body as { detail?: unknown })?.detail;
          setError(typeof detail === "string" ? detail : "One image could not be attached.");
          break;
        }
        onAttached(await res.json());
        attached += 1;
        setDone(attached);
      } catch {
        setError("Lost the connection part way through.");
        break;
      }
    }

    setBusy(false);
    if (attached === chosen.size) onClose();
  }

  return (
    <div
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-modal flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose images from the library"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-lg border
                   border-line bg-surface-0 shadow-e3 sm:max-h-[86vh] sm:rounded-lg"
      >
        {/* --- Header --- */}
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-headline-sm text-ink">Choose from the library</h2>
            <p className="mt-0.5 text-label-xs text-ink-subtle">
              Nothing is uploaded — the image is shared, not copied.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-ink-subtle
                       transition-colors duration-fast hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* --- Search --- */}
        <div className="shrink-0 border-b border-line px-5 py-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name…"
            aria-label="Search the media library by product name"
            className="h-10 w-full rounded-md border border-line bg-surface-1 px-3 text-body-sm
                       text-ink outline-none focus:border-brand-vivid"
          />
          <p className="mt-2 text-label-xs text-ink-faint">
            A file has no name worth typing, so this searches the products it is attached to.
          </p>
        </div>

        {/* --- Grid --- */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <ul
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(140px, 100%), 1fr))" }}
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <li key={i} className="dot-matrix aspect-square rounded-md border border-line" />
              ))}
            </ul>
          ) : assets.length === 0 ? (
            <div className="dot-matrix rounded-lg border border-line py-16 text-center">
              <p className="text-body-md text-ink-muted">
                {query.trim() ? "No image matches that product." : "The library is empty."}
              </p>
            </div>
          ) : (
            <ul
              className="grid gap-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(140px, 100%), 1fr))" }}
            >
              {assets.map((a) => {
                // Already here. The API would answer 409, but refusing after
                // the click is worse than not offering it.
                const mine = a.usedBy.some((u) => u.productId === productId);
                const on = chosen.has(a.id);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      disabled={mine || busy}
                      aria-pressed={on}
                      onClick={() => toggle(a.id)}
                      className={cn(
                        "panel group relative block w-full overflow-hidden text-left transition-all duration-fast",
                        on && "border-brand-vivid ring-2 ring-brand-vivid",
                        mine ? "cursor-default opacity-45" : "hover:border-brand-line",
                      )}
                    >
                      <span className="plate relative block aspect-square">
                        {a.thumbnailUrl ? (
                          <Image
                            src={a.thumbnailUrl}
                            alt={a.alt ?? ""}
                            fill
                            sizes="160px"
                            className="object-contain p-1.5"
                          />
                        ) : (
                          <span className="dot-matrix block h-full w-full" />
                        )}

                        {on && (
                          <span
                            className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center
                                       rounded-full bg-brand-fill text-[11px] font-bold text-brand-on"
                            aria-hidden="true"
                          >
                            ✓
                          </span>
                        )}

                        {/* The whole point, stated on the tile: this file is
                            already doing work elsewhere. */}
                        {a.usageCount > 1 && (
                          <span className="absolute left-1.5 top-1.5 rounded-xs bg-editorial-bg px-1.5 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.1em] text-editorial-fg">
                            ×{a.usageCount}
                          </span>
                        )}
                      </span>

                      <span className="block border-t border-line px-2 py-1.5">
                        <span className="block truncate text-label-xs text-ink">
                          {mine ? "Already on this product" : a.productTitle}
                        </span>
                        <span className="tabular block font-mono text-[10px] text-ink-faint">
                          {a.width ?? "?"}&times;{a.height ?? "?"} &middot; {fileSize(a.sizeBytes)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* --- Footer --- */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <p aria-live="polite" className="text-body-sm text-ink-muted">
            {error ? (
              <span className="text-danger">{error}</span>
            ) : busy ? (
              `Attaching ${done + 1} of ${chosen.size}…`
            ) : chosen.size === 0 ? (
              "Select one or more images."
            ) : (
              `${chosen.size} selected`
            )}
          </p>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center rounded-full border border-line-strong px-4
                         font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink
                         transition-colors duration-fast hover:border-brand hover:text-brand"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void attach()}
              disabled={chosen.size === 0 || busy}
              className="inline-flex h-10 items-center rounded-full bg-brand-fill px-5 font-label
                         text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                         shadow-brand transition-all duration-fast hover:brightness-110
                         disabled:pointer-events-none disabled:opacity-40"
            >
              {busy ? "Attaching…" : `Attach${chosen.size ? ` ${chosen.size}` : ""}`}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
