"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { MediaAsset } from "@/lib/types";

/**
 * Product image manager (spec §19).
 *
 * Ordering matters: **position 1 is the primary image**, the one every card
 * and search result shows. That is stated on the tile rather than left to be
 * discovered.
 *
 * Reordering supports both drag and arrow buttons. The buttons are not a
 * fallback afterthought — HTML5 drag is unusable with a keyboard and awkward
 * on touch, so they are the accessible path and drag is the enhancement.
 *
 * No new dependency: native `draggable` plus pointer events, consistent with
 * this project's zero-dependency stance.
 */
export function MediaManager({
  productId,
  initial,
}: {
  productId: string;
  initial: MediaAsset[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [items, setItems] = useState<MediaAsset[]>(
    [...initial].sort((a, b) => a.displayOrder - b.displayOrder),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  async function persistOrder(next: MediaAsset[]) {
    setItems(next);
    try {
      await fetch(`/admin/api/products/${productId}/media-order`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: next.map((m) => m.id) }),
      });
      router.refresh();
    } catch {
      setError("Could not save the new order.");
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    void persistOrder(next);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch(`/admin/api/products/${productId}/media`, {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          // Surface the server's actual reason — "not a readable image" is
          // genuinely useful, "upload failed" is not.
          setError(readable(body) ?? `${file.name} was rejected.`);
          break;
        }
        const media = (await res.json()) as MediaAsset;
        setItems((prev) => [...prev, media]);
      } catch {
        setError("Upload failed. Check your connection.");
        break;
      }
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function remove(id: string) {
    setError(null);
    const previous = items;
    setItems((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/admin/api/products/${productId}/media?mediaId=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) setItems(previous);
      else router.refresh();
    } catch {
      setItems(previous);
    }
  }

  return (
    <div>
      {/* --- Drop zone --- */}
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "dot-matrix flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg",
          "border-2 border-dashed border-line px-6 py-10 text-center transition-colors duration-fast",
          "hover:border-brand-line hover:bg-surface-1",
          busy && "pointer-events-none opacity-60",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => void onFiles(e.target.files)}
        />
        <UploadGlyph />
        <span className="font-label text-label font-semibold uppercase tracking-[0.08em] text-ink">
          {busy ? "Uploading…" : "Drop images, or click to choose"}
        </span>
        <span className="text-label-xs text-ink-subtle">
          JPEG, PNG or WebP · up to 8 MB · EXIF is stripped on upload
        </span>
      </label>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger-soft bg-danger-soft px-4 py-2.5 text-body-sm text-danger-on-soft">
          {error}
        </p>
      )}

      {/* --- Tiles --- */}
      {items.length > 0 && (
        <>
          <p className="mt-6 text-label-xs uppercase tracking-[0.1em] text-ink-subtle">
            Position 1 is the primary image — shown on every card.
          </p>

          <ul
            className="mt-3 grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(160px, 100%), 1fr))" }}
          >
            {items.map((m, i) => (
              <li
                key={m.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={cn(
                  "panel group relative overflow-hidden transition-all duration-fast",
                  i === 0 && "border-brand-vivid",
                  dragIndex === i && "opacity-40",
                )}
              >
                <div className="plate relative aspect-[4/3]">
                  {m.url ? (
                    <Image src={m.url} alt={m.alt ?? ""} fill sizes="200px" className="object-contain p-2" />
                  ) : (
                    <div className="dot-matrix h-full w-full" />
                  )}
                  {i === 0 && (
                    <span className="absolute left-2 top-2 rounded-xs bg-brand-fill px-2 py-0.5 font-label text-[9px] font-bold uppercase tracking-[0.12em] text-brand-on">
                      Primary
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 border-t border-line px-2 py-1.5">
                  <span className="font-mono text-[10px] tabular-nums text-ink-faint">
                    {i + 1}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <IconBtn label="Move earlier" onClick={() => move(i, i - 1)} disabled={i === 0}>
                      ←
                    </IconBtn>
                    <IconBtn
                      label="Move later"
                      onClick={() => move(i, i + 1)}
                      disabled={i === items.length - 1}
                    >
                      →
                    </IconBtn>
                    <IconBtn label="Delete image" onClick={() => void remove(m.id)} danger>
                      ✕
                    </IconBtn>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function readable(body: unknown): string | null {
  const d = (body as { detail?: unknown })?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return (d[0] as { msg?: string })?.msg ?? null;
  return null;
}

function IconBtn({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
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
        "grid h-6 w-6 place-items-center rounded-xs text-body-sm transition-colors duration-fast",
        "disabled:opacity-25 disabled:pointer-events-none",
        danger ? "text-ink-faint hover:bg-danger-soft hover:text-danger" : "text-ink-subtle hover:bg-surface-2 hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function UploadGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-ink-subtle" aria-hidden="true">
      <path d="M12 16V4M12 4 7.5 8.5M12 4l4.5 4.5" />
      <path d="M3.5 15v3.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V15" />
    </svg>
  );
}
