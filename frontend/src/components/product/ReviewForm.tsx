"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { MediaAsset } from "@/lib/types";

const MAX_IMAGES = 6;
const MAX_VIDEO_SECONDS = 30;
const MIN_BODY = 20;

/**
 * Write a review (spec §28–§29).
 *
 * Two things this deliberately does NOT do:
 *
 *  - It never says "Verified Buyer". There is no purchase verification, so
 *    claiming one would be a lie (spec §31).
 *  - It does not pretend media validation happens here. The browser check
 *    below is a *courtesy* — it catches an over-long clip before the user
 *    waits for an upload — but the server re-reads the container and is the
 *    only thing that decides.
 *
 * Media attaches to a review that already exists, so the flow is: submit the
 * text first, then add photos. That also means a half-finished upload can
 * never lose someone's written review.
 */
type Stage = "writing" | "media" | "done";

export function ReviewForm({
  productId,
  productTitle,
  isAuthed,
  onClose,
}: {
  productId: string;
  productTitle: string;
  isAuthed: boolean;
  onClose?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const fileRef = useRef<HTMLInputElement>(null);

  const [stage, setStage] = useState<Stage>("writing");
  const [reviewId, setReviewId] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imageCount = media.filter((m) => m.kind === "image").length;
  const videoCount = media.filter((m) => m.kind === "video").length;

  if (!isAuthed) {
    return (
      <div className="panel p-6">
        <p className="text-body-md text-ink">
          {/* Carries the product page through login. A bare /login sent the
              reader home afterwards, so the review they came to write was two
              navigations away from a form they were already looking at. */}
          <Link
            href={`/login?next=${encodeURIComponent(pathname)}`}
            className="text-brand hover:underline"
          >
            Sign in
          </Link>{" "}
          to write a review.
        </p>
        <p className="mt-2 text-body-sm text-ink-muted">
          An account only takes a moment, and it&apos;s what keeps this section free of spam.
        </p>
      </div>
    );
  }

  async function submitText(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          rating,
          title: title.trim() || null,
          body: body.trim(),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(readable(d) ?? "Could not post that review.");
        return;
      }
      const created = await res.json();
      setReviewId(created.id);
      setStage("media");
    } catch {
      setError("Could not post that review. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  /** Browser-side pre-check. A convenience, never the control. */
  function localDuration(file: File): Promise<number | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(Number.isFinite(v.duration) ? v.duration : null);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      v.src = url;
    });
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || !reviewId) return;
    setBusy(true);
    setError(null);

    for (const file of Array.from(files)) {
      const isVideo = file.type.startsWith("video/");

      if (isVideo) {
        if (videoCount >= 1) {
          setError("One video per review.");
          break;
        }
        const secs = await localDuration(file);
        // Only reject on a *confident* read. If the browser cannot decode it,
        // let the server decide rather than blocking a valid file.
        if (secs !== null && secs > MAX_VIDEO_SECONDS + 0.5) {
          setError(`That clip is ${secs.toFixed(1)}s — the limit is ${MAX_VIDEO_SECONDS}s.`);
          break;
        }
      } else if (imageCount + 1 > MAX_IMAGES) {
        setError(`Up to ${MAX_IMAGES} photos per review.`);
        break;
      }

      const form = new FormData();
      form.append("file", file);
      form.append("review_id", reviewId);

      try {
        const res = await fetch("/api/reviews/media", { method: "POST", body: form });
        if (!res.ok) {
          const d = await res.json().catch(() => null);
          setError(readable(d) ?? `${file.name} was rejected.`);
          break;
        }
        // Await first: the state updater is not async, so awaiting
        // inside it is a syntax error.
        const uploaded = (await res.json()) as MediaAsset;
        setMedia((prev) => [...prev, uploaded]);
      } catch {
        setError("Upload failed.");
        break;
      }
    }

    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removeMedia(id: string) {
    const previous = media;
    setMedia((prev) => prev.filter((m) => m.id !== id));
    const res = await fetch(`/api/reviews/media?mediaId=${id}`, { method: "DELETE" });
    if (!res.ok) setMedia(previous);
  }

  function finish() {
    setStage("done");
    router.refresh();
  }

  /* ---------------------------------------------------------------- */

  if (stage === "done") {
    return (
      <div className="panel dot-matrix p-8">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-value-soft text-value-on-soft">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m4 12.5 5 5L20 6.5" />
          </svg>
        </span>
        <h3 className="mt-5 text-headline-sm text-ink">Thanks — it&apos;s in the queue.</h3>
        <p className="mt-2 max-w-lg text-body-md text-ink-muted">
          Every review is read by a person before it appears. That applies to everyone, and
          it&apos;s why this section stays worth reading. You&apos;ll find it under{" "}
          <a href="/account/reviews" className="text-brand hover:underline">
            your reviews
          </a>{" "}
          in the meantime.
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mt-6 font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
          >
            Close
          </button>
        )}
      </div>
    );
  }

  if (stage === "media") {
    return (
      <div className="panel p-6 lg:p-8">
        <h3 className="text-headline-sm text-ink">Add photos or a short video</h3>
        <p className="mt-2 text-body-sm text-ink-muted">
          Optional — your review is already saved. Up to {MAX_IMAGES} photos and one video of{" "}
          {MAX_VIDEO_SECONDS} seconds or less.
        </p>

        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void onFiles(e.dataTransfer.files);
          }}
          className={cn(
            "dot-matrix mt-5 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2",
            "border-dashed border-line px-6 py-8 text-center transition-colors duration-fast",
            "hover:border-brand-line hover:bg-surface-1",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
            multiple
            className="sr-only"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <span className="font-label text-label font-semibold uppercase tracking-[0.08em] text-ink">
            {busy ? "Uploading…" : "Drop files, or click to choose"}
          </span>
          <span className="text-label-xs text-ink-subtle">
            {imageCount}/{MAX_IMAGES} photos · {videoCount}/1 video
          </span>
        </label>

        {error && (
          <p role="alert" className="mt-3 rounded-md border border-danger-soft bg-danger-soft px-4 py-2.5 text-body-sm text-danger-on-soft">
            {error}
          </p>
        )}

        {media.length > 0 && (
          <ul className="mt-5 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(120px, 100%), 1fr))" }}>
            {media.map((m) => (
              <li key={m.id} className="panel relative overflow-hidden">
                <div className="plate relative aspect-square">
                  {m.kind === "image" && m.url ? (
                    <Image src={m.url} alt="" fill sizes="140px" className="object-cover" />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <span className="font-mono text-label-xs tabular-nums text-ink-muted">
                        {m.durationSeconds ? `${m.durationSeconds}s` : "video"}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void removeMedia(m.id)}
                  aria-label="Remove"
                  className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full
                             bg-surface-0/90 text-ink-subtle backdrop-blur-sm transition-colors
                             duration-fast hover:text-danger"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex items-center gap-4">
          <button
            type="button"
            onClick={finish}
            className="inline-flex h-11 items-center rounded-full bg-brand-fill px-7 font-label
                       text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                       shadow-brand transition-all duration-fast hover:brightness-110"
          >
            Done
          </button>
          <span className="text-label-xs text-ink-faint">
            Media is reviewed before it appears publicly.
          </span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submitText} noValidate className="panel p-6 lg:p-8">
      <h3 className="text-headline-sm text-ink">Review {productTitle}</h3>
      <p className="mt-2 text-body-sm text-ink-muted">
        What did you actually think? Specifics help other people more than adjectives.
      </p>

      {/* --- Rating --- */}
      <fieldset className="mt-6">
        <legend className="t-eyebrow mb-3">Your rating</legend>
        <div className="flex items-center gap-2" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              className="transition-transform duration-fast hover:scale-110"
            >
              <svg width="30" height="30" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  d="m8 1.6 1.9 4 4.3.6-3.1 3 .7 4.3L8 11.5l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
                  fill={n <= (hover || rating) ? "var(--c-star)" : "var(--c-line-strong)"}
                />
              </svg>
            </button>
          ))}
          {rating > 0 && (
            <span className="tabular ml-2 text-body-sm text-ink-muted">{rating}/5</span>
          )}
        </div>
      </fieldset>

      <label className="mt-6 block">
        <span className="t-eyebrow">Headline</span>
        <input
          type="text"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum it up in a few words"
          className={input}
        />
      </label>

      <label className="mt-5 block">
        <span className="t-eyebrow flex items-center justify-between">
          Your review
          <span
            className={cn(
              "font-mono text-[10px] tabular-nums normal-case tracking-normal",
              body.trim().length < MIN_BODY ? "text-ink-faint" : "text-value",
            )}
          >
            {body.trim().length} / {MIN_BODY} min
          </span>
        </span>
        <textarea
          required
          rows={6}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="How have you actually used it? What surprised you, good or bad?"
          className={cn(input, "mt-2 min-h-[150px] resize-y py-3 leading-relaxed")}
        />
      </label>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-danger-soft bg-danger-soft px-4 py-2.5 text-body-sm text-danger-on-soft">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={busy || rating === 0 || body.trim().length < MIN_BODY}
          className="inline-flex h-11 items-center rounded-full bg-brand-fill px-7 font-label
                     text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                     shadow-brand transition-all duration-fast hover:brightness-110
                     disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Posting…" : "Post review"}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-ink"
          >
            Cancel
          </button>
        )}
        <span className="text-label-xs text-ink-faint">
          Reviewed by a person before it appears.
        </span>
      </div>
    </form>
  );
}

const input =
  "mt-2 h-12 w-full rounded-md border border-line bg-surface-0 px-4 text-body-md text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";

function readable(body: unknown): string | null {
  const d = (body as { detail?: unknown })?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return (d[0] as { msg?: string })?.msg ?? null;
  return null;
}
