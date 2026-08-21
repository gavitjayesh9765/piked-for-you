"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Save to shortlist.
 *
 * Deliberately a bookmark, not a cart: PickDForYou sells nothing (spec §56).
 * The label says "Save" / "Saved", never "Add to".
 *
 * Optimistic — the state flips immediately and reverts if the request fails.
 * Saving is low-stakes and reversible, so waiting on a round trip would make
 * the whole grid feel sluggish for no benefit.
 */
export function SaveButton({
  productId,
  initialSaved = false,
  isAuthed,
  variant = "icon",
}: {
  productId: string;
  initialSaved?: boolean;
  isAuthed: boolean;
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    // The card wraps this in a link overlay; without this the click navigates.
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthed) {
      router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    const next = !saved;
    setSaved(next);
    setBusy(true);

    try {
      const res = next
        ? await fetch("/api/me/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          })
        : await fetch(`/api/me/saved?productId=${productId}`, { method: "DELETE" });

      if (!res.ok) setSaved(!next);
    } catch {
      setSaved(!next);
    } finally {
      setBusy(false);
    }
  }

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={saved}
        className={cn(
          "inline-flex h-12 items-center justify-center gap-2 rounded-full border px-6",
          "font-label text-label-xs font-semibold uppercase tracking-[0.08em]",
          "transition-all duration-fast ease-ease disabled:opacity-60",
          saved
            ? "border-brand-vivid bg-brand-soft text-brand-on-soft"
            : "border-line-strong text-ink hover:border-brand hover:text-brand",
        )}
      >
        <BookmarkGlyph filled={saved} />
        {saved ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved" : "Save product"}
      title={saved ? "Remove from saved" : "Save product"}
      className={cn(
        "relative z-10 grid h-9 w-9 place-items-center rounded-full border",
        "transition-all duration-fast ease-ease disabled:opacity-60",
        saved
          ? "border-brand-vivid bg-brand-soft text-brand"
          : "border-line bg-surface-0/90 text-ink-subtle hover:border-brand hover:text-brand",
      )}
    >
      <BookmarkGlyph filled={saved} />
    </button>
  );
}

function BookmarkGlyph({ filled }: { filled: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3.5h12a1 1 0 0 1 1 1V21l-7-4.2L5 21V4.5a1 1 0 0 1 1-1Z" />
    </svg>
  );
}
