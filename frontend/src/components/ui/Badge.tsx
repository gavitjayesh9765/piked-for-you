import { cn } from "@/lib/cn";
import type { Badge as BadgeModel, BadgeStyle } from "@/lib/types";

/**
 * Badges are admin-created content (spec §21) — never hard-coded. The admin
 * picks a *style token*, not a colour, so a new badge inherits the system and
 * can't introduce an off-palette hue.
 */
const styles: Record<BadgeStyle, string> = {
  // The editorial badge: obsidian in light, inverted in dark so it keeps its
  // authority on a black page rather than disappearing into it.
  editorial: "bg-editorial-bg text-editorial-fg border-transparent",
  brand: "bg-brand-soft text-brand-on-soft border-brand-line",
  value: "bg-value-soft text-value-on-soft border-value-line",
  warn: "bg-warn-soft text-warn-on-soft border-transparent",
  neutral: "bg-surface-2 text-ink-muted border-line",
};

export function Badge({
  badge,
  size = "md",
  className,
}: {
  badge: Pick<BadgeModel, "name" | "style" | "icon">;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border font-label font-semibold uppercase",
        "rounded-xs whitespace-nowrap",
        size === "sm"
          ? "px-2 py-1 text-label-xs tracking-[0.12em]"
          : "px-3 py-1.5 text-label-xs tracking-[0.14em]",
        styles[badge.style],
        className,
      )}
    >
      {badge.icon ? <span aria-hidden="true" className="shrink-0">{badge.icon}</span> : null}
      {/* The name is its own flex item so a caller that lets the badge shrink
          (a narrow product card) gets an ellipsis rather than a badge that
          refuses to give ground and widens the whole card past the viewport. */}
      <span className="truncate">{badge.name}</span>
    </span>
  );
}

/**
 * The green "worth it" signal. Outline + tint, never a solid fill — a solid
 * green block would compete with the retail CTA for attention, and value is a
 * supporting signal, not an action.
 */
export function ValueChip({ label = "Worth it", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xs border border-value-line bg-value-soft",
        "px-2.5 py-1 font-label text-label-xs font-bold uppercase tracking-[0.12em] text-value-on-soft",
        className,
      )}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="m3 8.5 3.2 3.2L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}

/**
 * Community rating (spec §32). Deliberately quiet, grey-and-gold, and always
 * carries its review count so it reads as "what other people said" rather than
 * as a second PickD verdict.
 */
export function CommunityRating({
  average,
  count,
  className,
}: {
  average: number;
  count: number;
  className?: string;
}) {
  const value = Number(average);
  const safe = Number.isFinite(value) ? value : 0;
  const rounded = Math.round(safe);
  return (
    <div className={cn("flex items-center gap-2 text-ink-subtle", className)}>
      <div className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} width="13" height="13" viewBox="0 0 16 16">
            <path
              d="m8 1.6 1.9 4 4.3.6-3.1 3 .7 4.3L8 11.5l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
              fill={i <= rounded ? "var(--c-star)" : "var(--c-line-strong)"}
            />
          </svg>
        ))}
      </div>
      <span className="tabular text-body-sm">{safe.toFixed(1)}</span>
      <span className="text-body-sm">
        · {count} {count === 1 ? "review" : "reviews"}
      </span>
    </div>
  );
}

/** Publication state pill for admin tables (spec §61). */
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "bg-value-soft text-value-on-soft border-value-line",
    draft: "bg-surface-2 text-ink-muted border-line",
    archived: "bg-surface-2 text-ink-faint border-line",
    pending: "bg-warn-soft text-warn-on-soft border-transparent",
    approved: "bg-value-soft text-value-on-soft border-value-line",
    rejected: "bg-danger-soft text-danger-on-soft border-transparent",
    reported: "bg-danger-soft text-danger-on-soft border-transparent",
    hidden: "bg-surface-2 text-ink-faint border-line",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xs border px-2 py-0.5",
        "font-label text-label-xs font-semibold uppercase tracking-[0.1em]",
        map[status] ?? map.draft,
      )}
    >
      {status}
    </span>
  );
}
