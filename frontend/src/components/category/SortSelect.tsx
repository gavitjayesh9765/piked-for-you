"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import type { SortOption } from "@/lib/types";
import { Shuttle } from "@/components/ui/Shuttle";

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
  // Re-sorting keeps the current results on screen while the new order is
  // fetched, which is right — but it also means nothing at all would happen
  // visibly if the request were slow. The transition gives the control itself
  // something honest to say, in the same shuttle the sub-nav uses.
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const q = new URLSearchParams(params.toString());
    q.set("sort", next);
    startTransition(() => router.push(`${pathname}?${q.toString()}`, { scroll: false }));
  }

  return (
    <label className="flex min-w-0 items-center gap-3">
      <span className="t-eyebrow whitespace-nowrap">Sort by</span>
      {/* `min-w-0 flex-1` on narrow screens: the widest option ("Price: low to
          high") otherwise sets the control's floor and squeezes the result
          count beside it onto two lines. */}
      <span className="relative min-w-0 flex-1 overflow-hidden sm:flex-none">
        <select
          value={value}
          onChange={(e) => change(e.target.value)}
          aria-busy={pending}
          className="w-full min-w-0 cursor-pointer rounded-sm border border-line bg-surface-0 px-3 py-2
                     text-body-sm text-ink outline-none transition-colors duration-fast
                     hover:border-line-strong focus:border-brand-vivid"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {pending ? (
          <Shuttle />
        ) : null}
      </span>
    </label>
  );
}
