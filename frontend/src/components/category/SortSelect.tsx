"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SortOption } from "@/lib/types";

/** Sort control (spec §17). Default is score_desc — our verdict leads, not price. */
const options: { value: SortOption; label: string }[] = [
  { value: "score_desc", label: "PickD Score" },
  { value: "rating_desc", label: "Community rating" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "newest", label: "Recently added" },
];

export function SortSelect({ value }: { value: SortOption }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function change(next: string) {
    const q = new URLSearchParams(params.toString());
    q.set("sort", next);
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  }

  return (
    <label className="flex min-w-0 items-center gap-3">
      <span className="t-eyebrow whitespace-nowrap">Sort by</span>
      {/* `min-w-0 flex-1` on narrow screens: the widest option ("Price: low to
          high") otherwise sets the control's floor and squeezes the result
          count beside it onto two lines. */}
      <select
        value={value}
        onChange={(e) => change(e.target.value)}
        className="min-w-0 flex-1 cursor-pointer rounded-sm border border-line bg-surface-0 px-3 py-2
                   text-body-sm text-ink outline-none transition-colors duration-fast
                   hover:border-line-strong focus:border-brand-vivid sm:flex-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
