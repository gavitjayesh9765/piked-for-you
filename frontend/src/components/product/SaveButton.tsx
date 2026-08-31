"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { useSaved } from "./SavedProvider";

/**
 * Save to shortlist.
 *
 * Deliberately a bookmark, not a cart: SortedChoice sells nothing (spec §56).
 * The label says "Save" / "Saved", never "Add to".
 *
 * Optimistic — the state flips immediately and reverts if the request fails.
 * Saving is low-stakes and reversible, so waiting on a round trip would make
 * the whole grid feel sluggish for no benefit.
 */
export function SaveButton({
  productId,
  initialSaved,
  isAuthed: isAuthedProp,
  variant = "icon",
}: {
  productId: string;
  /** Overrides the shared state. Only the styleguide needs this — every real
   *  surface reads the viewer from context, because no caller ever passed it. */
  initialSaved?: boolean;
  isAuthed?: boolean;
  variant?: "icon" | "full";
}) {
  const router = useRouter();
  const shared = useSaved();

  // Props win where given; otherwise the provider answers. Outside the site
  // shell (styleguide, admin preview) neither exists and the control renders
  // its signed-out state, which is the correct thing to show there.
  const isAuthed = isAuthedProp ?? shared?.isAuthed ?? false;
  const fromShared = shared?.has(productId) ?? false;

  /**
   * Local state exists only for the in-flight optimistic flip. The shared set
   * is the source of truth once it has answered, which is what keeps two cards
   * showing the same product in agreement — the alternatives row and the
   * category grid can both be on screen at once.
   */
  const [pendingSaved, setPendingSaved] = useState<boolean | null>(null);
  const saved = pendingSaved ?? initialSaved ?? fromShared;
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
    setPendingSaved(next);
    setBusy(true);

    try {
      const res = next
        ? await fetch("/api/me/saved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          })
        : await fetch(`/api/me/saved?productId=${productId}`, { method: "DELETE" });

      if (res.ok) {
        // Hand the result to the shared set and stand down, so this control and
        // every other one showing the same product agree from here on.
        shared?.setSaved(productId, next);
        if (shared) setPendingSaved(null);
      } else {
        setPendingSaved(null);
      }
    } catch {
      setPendingSaved(null);
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
        // 32px in the product card's overlay strip, 36px once the card is wide
        // enough for a header row. Matches ProductCard's `lg` split.
        "relative z-10 grid h-8 w-8 place-items-center rounded-full border lg:h-9 lg:w-9",
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
