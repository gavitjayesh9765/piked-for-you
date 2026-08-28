"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The search field (spec §33, and the design system's "Search Bar" component).
 *
 * Rule-only treatment: no filled background, just a bottom hairline that draws
 * itself purple on focus. Inspired by the usability of large shopping platforms
 * without copying their chrome (spec §12).
 */
export function SearchField({
  placeholder = "Search products, brands, or categories…",
  size = "md",
  defaultValue = "",
  autoFocus = false,
  className,
}: {
  placeholder?: string;
  size?: "md" | "lg";
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      /* `field-rule` draws a 2px brand rule across the field's own hairline
         from the left on focus, rather than recolouring the hairline in place.
         A rule-only field has no filled box for the global focus outline to
         sit on, so this IS the focus affordance — and a line that draws reads
         as the field opening, where a colour swap reads as a state flag. */
      className={cn(
        "group field-rule relative flex items-center gap-3 border-b border-line",
        size === "lg" ? "pb-3" : "pb-2",
        className,
      )}
    >
      <svg
        width={size === "lg" ? 22 : 18}
        height={size === "lg" ? 22 : 18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        aria-hidden="true"
        className="shrink-0 text-ink-subtle transition-colors duration-fast group-focus-within:text-brand"
      >
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m20 20-4.7-4.7" />
      </svg>

      <input
        type="search"
        name="q"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className={cn(
          "w-full bg-transparent text-ink outline-none placeholder:text-ink-faint",
          "[&::-webkit-search-cancel-button]:appearance-none",
          size === "lg" ? "text-body-lg" : "text-body-md",
        )}
      />

      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="shrink-0 text-ink-faint transition-colors duration-fast hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      )}
    </form>
  );
}
