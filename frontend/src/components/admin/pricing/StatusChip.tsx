import { cn } from "@/lib/cn";
import { RUN_STATUS_STYLE, SCRAPE_STATUS_STYLE } from "@/lib/pricing";
import type { RunStatus, ScrapeStatus } from "@/lib/types";

/**
 * One chip, one vocabulary of tones, used by every pricing table.
 *
 * The tones map to the same design tokens the public site uses, so a "held
 * back" reading is amber in the admin panel for the same reason a warning
 * badge is amber on a product page — the palette is not re-invented per screen.
 */
const TONES = {
  value: "bg-value-soft text-value-on-soft border-value-line",
  warn: "bg-warn-soft text-warn-on-soft border-transparent",
  danger: "bg-danger-soft text-danger-on-soft border-transparent",
  brand: "bg-brand-soft text-brand-on-soft border-brand-line",
  neutral: "bg-surface-2 text-ink-muted border-line",
} as const;

function Chip({
  label,
  tone,
  className,
}: {
  label: string;
  tone: keyof typeof TONES;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs border px-2 py-1",
        "font-label text-label-xs font-semibold uppercase tracking-[0.1em]",
        TONES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function ScrapeStatusChip({
  status,
  className,
}: {
  status: ScrapeStatus;
  className?: string;
}) {
  const style = SCRAPE_STATUS_STYLE[status];
  return <Chip label={style.label} tone={style.tone} className={className} />;
}

export function RunStatusChip({ status, className }: { status: RunStatus; className?: string }) {
  const style = RUN_STATUS_STYLE[status];
  return (
    <Chip
      label={style.label}
      tone={style.tone}
      className={cn(status === "running" && "animate-pulse", className)}
    />
  );
}
