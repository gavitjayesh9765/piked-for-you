"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { NEWSLETTER_FREQUENCIES } from "@/lib/newsletter";

/**
 * Cadence filter for the subscriber list.
 *
 * Same mechanism as `ProductListControls` and `MessageListControls`: writes to
 * the URL rather than to component state, so a filtered view is shareable,
 * survives a refresh and the back button behaves. Every change resets to page
 * one, or switching cadence from page three lands on page three of a shorter
 * list and reads as rows silently disappearing.
 *
 * Cadence is the filter that matters here because it is what the send job
 * partitions on — "how many people actually want a daily email?" is the
 * question that decides whether the daily list is worth writing.
 */
export function SubscriberListControls({ frequency }: { frequency?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");

    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-1.5">
        <span className="sr-only">Cadence</span>
        <select
          value={frequency ?? ""}
          onChange={(e) => set("frequency", e.target.value)}
          aria-label="Cadence"
          className={cn(
            "h-9 cursor-pointer rounded-sm border border-line bg-surface-1 px-2.5 pr-7",
            "text-body-sm outline-none transition-colors duration-fast focus:border-brand-vivid",
            frequency ? "border-line-strong text-ink" : "text-ink-muted",
          )}
        >
          <option value="">Any cadence</option>
          {NEWSLETTER_FREQUENCIES.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>

      {frequency && (
        <button
          type="button"
          onClick={() => set("frequency", "")}
          className="font-label text-label-xs uppercase tracking-[0.08em] text-ink-subtle hover:text-brand"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
