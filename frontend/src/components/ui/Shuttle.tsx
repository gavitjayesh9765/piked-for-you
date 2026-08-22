import { cn } from "@/lib/cn";

/**
 * The only progress indicator this product has.
 *
 * A 2px line that runs inside a rule the layout already draws — the sub-nav's
 * bottom border, the filter rail's header rule, the admin bar's edge. Never a
 * bar laid over the page, never a spinner, never a full-screen state. Overlaying
 * a progress bar says "the application is busy"; putting it in the rule beneath
 * the control you just used says "this is fetching", which is both narrower and
 * true.
 *
 * It is invisible for its own first 250ms (see `.shuttle` in globals.css), so a
 * prefetched navigation — the common case — renders it and shows nothing. Mount
 * it only while something is actually pending; the parent needs `relative` and
 * `overflow-hidden`.
 */
export function Shuttle({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("absolute inset-x-0 bottom-0 block h-[2px] overflow-hidden", className)}
    >
      <span className="shuttle block h-full w-full bg-brand" />
    </span>
  );
}
