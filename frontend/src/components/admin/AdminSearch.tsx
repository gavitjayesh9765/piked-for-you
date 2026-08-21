"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Search box that writes to the URL, so a filtered view is shareable and the
 * back button works.
 *
 * `action` sends the query to a fixed screen instead of filtering the current
 * one — that is what the header search needs, since it can be typed into from
 * any admin page. Without it the box stays on the page it is on, which is what
 * the per-screen searches want.
 */
export function AdminSearch({
  placeholder = "Search…",
  defaultValue = "",
  action,
  className,
}: {
  placeholder?: string;
  defaultValue?: string;
  /** Destination path. Defaults to the current page. */
  action?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    const target = action ?? pathname;

    // Filtering in place keeps the other params (status tabs, and so on);
    // jumping to another screen starts clean, because they would not mean the
    // same thing there.
    const next = target === pathname ? new URLSearchParams(params.toString()) : new URLSearchParams();

    if (q) next.set("q", q);
    else next.delete("q");
    // A new query always starts at page one — otherwise a search from page 4
    // lands on page 4 of a different, shorter result set.
    next.delete("page");

    const qs = next.toString();
    router.push(qs ? `${target}?${qs}` : target);
  }

  return (
    <form role="search" onSubmit={submit} className={cn("w-full max-w-sm", className)}>
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full rounded-sm border border-line bg-surface-1 px-3 text-body-sm text-ink
                   outline-none transition-colors duration-fast placeholder:text-ink-faint
                   focus:border-brand-vivid"
      />
    </form>
  );
}
