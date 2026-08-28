"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Re-fetch the current admin screen without a browser reload.
 *
 * Every admin page is `force-dynamic` and every upstream call is `no-store`,
 * so nothing here is working around a cache. It exists for the two cases where
 * the screen is genuinely behind the database and cannot know it:
 *
 *   1. Someone else changed something — a second editor, a price run, a
 *      moderation queue filling up while the tab sits open.
 *   2. The signed URLs on this page have expired. Product media is served from
 *      a private bucket through time-limited signatures (core/storage.py), so
 *      a tab left open long enough starts showing broken images even though
 *      nothing is actually wrong. `router.refresh()` re-mints them.
 *
 * Lives in `AdminPage`'s header rather than on individual screens, so all of
 * them get it and none of them have to remember to.
 *
 * The timestamp is deliberately mounted-only. Rendering "updated just now" on
 * the server would be a hydration mismatch and, worse, a lie — the server does
 * not know when this tab last saw the data.
 */
export function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [at, setAt] = useState<string | null>(null);
  const [, tick] = useState(0);

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh();
      setAt(new Date().toISOString());
    });
  }, [router]);

  // First paint after hydration establishes "this is when the page's data
  // arrived". Not a refresh — just the baseline the label counts from.
  useEffect(() => setAt(new Date().toISOString()), []);

  // Re-render the relative label on a slow beat. `relativeTime` has
  // minute granularity, so 15s is comfortably fine enough and costs nothing.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  // "r" refreshes, the way it does in most consoles — but only when it is not
  // a keystroke that belongs to something else. Typing "r" into the product
  // search must never reload the screen out from under the caret.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "r" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (el?.isContentEditable || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      refresh();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh]);

  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {at && (
        <span className="tabular hidden whitespace-nowrap text-label-xs text-ink-faint sm:inline">
          {pending ? "Updating…" : `Updated ${relativeTime(at)}`}
        </span>
      )}
      <button
        type="button"
        onClick={refresh}
        disabled={pending}
        aria-label="Refresh this page"
        title="Refresh this page (R)"
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-4",
          "font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink",
          "transition-all duration-fast ease-ease hover:border-brand hover:text-brand",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        <RefreshGlyph spinning={pending} />
        <span className="hidden md:inline">Refresh</span>
      </button>
      {/* Announced rather than shown: a sighted user sees the rows change. */}
      <span role="status" aria-live="polite" className="sr-only">
        {pending ? "Refreshing" : at ? "Page updated" : ""}
      </span>
    </span>
  );
}

function RefreshGlyph({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0", spinning && "motion-safe:animate-spin")}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
