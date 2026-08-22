"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import type { FilterFacet } from "@/lib/types";
import { Shuttle } from "@/components/ui/Shuttle";

/**
 * Faceted filters (spec §17). Facets are configured per category and arrive
 * from the API with counts — this component never knows what "brand" or
 * "score" mean, it just renders whatever facets it is given.
 *
 * State lives in the URL so a filtered view is shareable and back/forward work.
 *
 * On `lg` the rail is a persistent sticky column beside the grid. Below that it
 * collapses behind a "Refine" toggle: stacked, the expanded facet list runs to
 * roughly a full screen, so leaving it open would mean scrolling past every
 * brand and score band before reaching a single product. The panel keeps
 * `lg:block` so the desktop rendering never depends on client state — the rail
 * is already correct on the first paint, before any JS runs. The effect below
 * only brings `aria-expanded` into line with what a desktop reader is actually
 * seeing; it is not what makes the panel visible.
 */
export function FilterRail({ facets, basePath }: { facets: FilterFacet[]; basePath: string }) {
  const router = useRouter();
  const params = useSearchParams();
  // Refining keeps the current grid on screen rather than blanking it (see the
  // category page's Suspense key), so the rail is the only place that can
  // acknowledge the request. Same shuttle as the sub-nav, in the rail's own
  // rule — deferred, so a fast refine shows nothing at all.
  const [pending, startTransition] = useTransition();

  function push(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  function toggle(key: string, value: string, multi: boolean) {
    const next = new URLSearchParams(params.toString());
    if (multi) {
      const existing = next.getAll(key);
      next.delete(key);
      const updated = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      updated.forEach((v) => next.append(key, v));
    } else {
      if (next.get(key) === value) next.delete(key);
      else next.set(key, value);
    }
    push(`${basePath}?${next.toString()}`);
  }

  const activeCount = [...params.keys()].filter((k) => k !== "sort").length;
  const [open, setOpen] = useState(false);

  // `lg:block` already reveals the panel on desktop; this keeps the toggle's
  // announced state truthful there rather than claiming a collapsed rail.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => mq.matches && setOpen(true);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <aside aria-label="Filters" className="lg:sticky lg:top-[calc(var(--nav-h)+var(--subnav-h)+1.5rem)] lg:self-start">
      <div className="relative flex items-center justify-between overflow-hidden border-b border-line pb-4">
        {/* A control on touch, a heading on desktop — the same line of type
            either way, so the rail reads identically at both sizes. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="filter-facets"
          className="flex items-center gap-2 lg:cursor-default"
        >
          <h2 className="t-eyebrow">Refine</h2>
          {activeCount > 0 && (
            <span className="tabular grid h-5 min-w-5 place-items-center rounded-full bg-brand-fill px-1.5 text-label-xs font-bold text-brand-on">
              {activeCount}
            </span>
          )}
          <Chevron className={cn("text-ink-subtle transition-transform duration-fast lg:hidden", open && "rotate-180")} />
        </button>
        {activeCount > 0 && (
          <button
            onClick={() => push(basePath)}
            className="font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
          >
            Clear all
          </button>
        )}

        {pending ? (
          <Shuttle />
        ) : null}
      </div>

      <div id="filter-facets" className={cn("divide-y divide-line lg:block", open ? "block" : "hidden")}>
        {facets.map((facet) => {
          const multi = facet.key === "brand" || facet.key === "badge";
          const selected = multi ? params.getAll(facet.key) : [params.get(facet.key) ?? ""];

          return (
            <fieldset key={facet.key} className="py-6">
              <legend className="t-eyebrow mb-4">{facet.label}</legend>
              <div className="space-y-2.5">
                {facet.options.map((opt) => {
                  const checked = selected.includes(opt.value);
                  return (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer items-center gap-3 text-body-sm text-ink-muted
                                 transition-colors duration-fast hover:text-ink"
                    >
                      <input
                        type={multi ? "checkbox" : "radio"}
                        name={facet.key}
                        checked={checked}
                        onChange={() => toggle(facet.key, opt.value, multi)}
                        className="h-4 w-4 shrink-0 accent-[var(--c-brand-fill)]"
                      />
                      <span className="flex-1">{opt.label}</span>
                      <span className="tabular text-label-xs text-ink-faint">{opt.count}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>
    </aside>
  );
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
