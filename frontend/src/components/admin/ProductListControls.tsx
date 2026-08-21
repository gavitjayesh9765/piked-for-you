"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PRICE_STATES, PRODUCT_SORTS } from "@/lib/product-sort";
import { cn } from "@/lib/cn";

/**
 * Sort and filter the admin catalogue.
 *
 * Everything writes to the URL rather than to component state, for the same
 * reason the status tabs and the search box do: a filtered view is then
 * shareable, survives a refresh, and the back button behaves. It also means
 * this component holds no state of its own — the URL is the state.
 *
 * Every change resets to page one. Without that, changing the sort from page
 * four lands on page four of a differently-ordered list, which looks like the
 * filter silently lost rows.
 */
export function ProductListControls({
  categories,
  brands,
  retailers,
  current,
}: {
  categories: { id: string; name: string }[];
  brands: { id: string; name: string }[];
  retailers: { slug: string; name: string }[];
  current: {
    sort: string;
    categoryId?: string;
    brandId?: string;
    retailer?: string;
    priceState?: string;
  };
}) {
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

  const filtered =
    !!current.categoryId || !!current.brandId || !!current.retailer || !!current.priceState;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        label="Sort"
        value={current.sort}
        onChange={(v) => set("sort", v)}
        options={PRODUCT_SORTS.map((s) => ({ value: s.value, label: s.label }))}
      />

      <Select
        label="Category"
        value={current.categoryId ?? ""}
        onChange={(v) => set("categoryId", v)}
        options={[
          { value: "", label: "All categories" },
          ...categories.map((c) => ({ value: c.id, label: c.name })),
        ]}
      />

      <Select
        label="Brand"
        value={current.brandId ?? ""}
        onChange={(v) => set("brandId", v)}
        options={[
          { value: "", label: "All brands" },
          ...brands.map((b) => ({ value: b.id, label: b.name })),
        ]}
      />

      <Select
        label="Retailer"
        value={current.retailer ?? ""}
        onChange={(v) => set("retailer", v)}
        options={[
          { value: "", label: "Any retailer" },
          ...retailers.map((r) => ({ value: r.slug, label: `Linked on ${r.name}` })),
        ]}
      />

      <Select
        label="Price"
        value={current.priceState ?? ""}
        onChange={(v) => set("priceState", v)}
        options={PRICE_STATES.map((s) => ({ value: s.value, label: s.label }))}
      />

      {filtered && (
        <button
          type="button"
          onClick={() => {
            // Keep the status tab and the search term — those came from
            // somewhere else on the screen and clearing them here would be a
            // surprise. Only this component's own filters are dropped.
            const next = new URLSearchParams(params.toString());
            for (const key of ["categoryId", "brandId", "retailer", "priceState", "page"]) {
              next.delete(key);
            }
            const qs = next.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
          }}
          className="font-label text-label-xs uppercase tracking-[0.08em] text-ink-subtle hover:text-brand"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          "h-9 cursor-pointer rounded-sm border border-line bg-surface-1 px-2.5 pr-7",
          "text-body-sm text-ink outline-none transition-colors duration-fast",
          "focus:border-brand-vivid",
          value ? "border-line-strong text-ink" : "text-ink-muted",
        )}
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
