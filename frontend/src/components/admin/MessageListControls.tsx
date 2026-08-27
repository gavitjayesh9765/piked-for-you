"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { CONTACT_TOPICS } from "@/lib/contact-topics";

/**
 * Topic filter for the contact queue.
 *
 * Deliberately the same mechanism as `ProductListControls`: writes to the URL,
 * never to component state, so a filtered view is shareable, survives a
 * refresh, and the back button behaves. Changing it resets to page one —
 * without that, switching topic from page three lands on page three of a
 * shorter list and looks like the filter lost rows.
 *
 * Topic is the filter this screen actually needs. Research requests are the
 * editorially valuable messages — they say what the audience wants covered
 * next — and they were buried among corrections and press mail with no way to
 * separate them.
 */
export function MessageListControls({ topic }: { topic?: string }) {
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
        <span className="sr-only">Topic</span>
        <select
          value={topic ?? ""}
          onChange={(e) => set("topic", e.target.value)}
          aria-label="Topic"
          className={cn(
            "h-9 cursor-pointer rounded-sm border border-line bg-surface-1 px-2.5 pr-7",
            "text-body-sm outline-none transition-colors duration-fast focus:border-brand-vivid",
            topic ? "border-line-strong text-ink" : "text-ink-muted",
          )}
        >
          <option value="">All topics</option>
          {CONTACT_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      {topic && (
        <button
          type="button"
          onClick={() => set("topic", "")}
          className="font-label text-label-xs uppercase tracking-[0.08em] text-ink-subtle hover:text-brand"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}
