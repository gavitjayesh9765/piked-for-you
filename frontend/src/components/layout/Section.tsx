import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Standard section header. Every homepage rail and category block uses this so
 * the vertical rhythm and the "View all" affordance stay identical across the
 * site (spec §16).
 */
export function SectionHeader({
  title,
  subtitle,
  eyebrow,
  href,
  hrefLabel = "View all",
  actions,
  className,
}: {
  title: string;
  subtitle?: string | null;
  eyebrow?: string;
  href?: string;
  hrefLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="max-w-2xl">
        {eyebrow ? <p className="t-eyebrow mb-3">{eyebrow}</p> : null}
        <h2 className="t-headline text-ink">{title}</h2>
        {subtitle ? <p className="mt-3 text-body-md text-ink-muted">{subtitle}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {actions}
        {href ? (
          <Link
            href={href}
            className="group inline-flex items-center gap-2 font-label text-label font-semibold
                       uppercase tracking-[0.08em] text-ink transition-colors duration-fast hover:text-brand"
          >
            {hrefLabel}
            <span className="transition-transform duration-fast ease-ease group-hover:translate-x-1">→</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/** Vertical rhythm wrapper — the only place section spacing is decided. */
export function Section({
  children,
  className,
  width = "wide",
}: {
  children: React.ReactNode;
  className?: string;
  width?: "full" | "wide" | "content";
}) {
  const shell = { full: "shell", wide: "shell-wide", content: "shell-content" }[width];
  return <section className={cn(shell, "mt-section", className)}>{children}</section>;
}
