"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import type { MediaAsset } from "@/lib/types";

/**
 * Product video links (spec §19).
 *
 * Links, not uploads. Hosting product video means a storage bill, egress, a
 * transcode pipeline and moderation; a YouTube or Vimeo URL costs nothing,
 * streams adaptively, and already has a poster frame.
 *
 * The URL is parsed server-side into a validated (provider, id) pair. The
 * embed address is then rebuilt from those parts — nothing the admin typed is
 * ever reflected into an iframe src.
 */
export function VideoLinks({
  productId,
  initial,
}: {
  productId: string;
  initial: MediaAsset[];
}) {
  const router = useRouter();
  const [videos, setVideos] = useState<MediaAsset[]>(
    initial.filter((m) => m.kind === "video_link"),
  );
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/products/${productId}/videos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), title: title.trim() || null }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(typeof d?.detail === "string" ? d.detail : "Could not add that link.");
        return;
      }
      const added = (await res.json()) as MediaAsset;
      setVideos((prev) => [...prev, added]);
      setUrl("");
      setTitle("");
      router.refresh();
    } catch {
      setError("Could not add that link.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const previous = videos;
    setVideos((prev) => prev.filter((v) => v.id !== id));
    const res = await fetch(`/admin/api/products/videos/${id}`, { method: "DELETE" });
    if (!res.ok) setVideos(previous);
    else router.refresh();
  }

  return (
    <div>
      <form onSubmit={add} className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          className="h-11 w-full rounded-md border border-line bg-surface-0 px-3.5 font-mono
                     text-body-sm text-ink outline-none transition-colors duration-fast
                     placeholder:text-ink-faint focus:border-brand-vivid"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Label (optional)"
          className="h-11 w-full rounded-md border border-line bg-surface-0 px-3.5 text-body-sm
                     text-ink outline-none transition-colors duration-fast
                     placeholder:text-ink-faint focus:border-brand-vivid"
        />
        <button
          type="submit"
          disabled={busy || url.trim().length < 8}
          className="h-11 shrink-0 rounded-full bg-brand-fill px-6 font-label text-label-xs
                     font-semibold uppercase tracking-[0.08em] text-brand-on shadow-brand
                     transition-all duration-fast hover:brightness-110
                     disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </form>

      <p className="mt-2 text-label-xs text-ink-faint">
        YouTube or Vimeo. We store the video id, not the raw link — and use
        youtube-nocookie, so no tracking cookie is set until someone presses play.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger-soft bg-danger-soft px-4 py-2.5 text-body-sm text-danger-on-soft">
          {error}
        </p>
      )}

      {videos.length > 0 && (
        <ul
          className="mt-5 grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(220px, 100%), 1fr))" }}
        >
          {videos.map((v) => (
            <li key={v.id} className="panel overflow-hidden">
              <div className="plate relative aspect-video">
                {v.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={v.thumbnailUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="dot-matrix h-full w-full" />
                )}
                <span className="absolute inset-0 grid place-items-center">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-surface-0/85 backdrop-blur-sm">
                    <PlayGlyph />
                  </span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-body-sm text-ink">
                    {v.title || "Untitled"}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                    {v.provider}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void remove(v.id)}
                  aria-label="Remove video"
                  className={cn(
                    "shrink-0 font-label text-label-xs uppercase tracking-[0.1em]",
                    "text-ink-faint transition-colors duration-fast hover:text-danger",
                  )}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="ml-0.5 text-ink">
      <path d="M8 5.5v13l11-6.5z" />
    </svg>
  );
}
