import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Shared admin chrome.
 *
 * These exist so the 13 admin screens are variations on one layout rather than
 * 13 bespoke pages. Same design tokens as the public site, tighter density —
 * this is a tool, not a storefront (docs/01-design-brainstorm.md §6).
 */

export function AdminPage({
  title,
  eyebrow,
  description,
  actions,
  children,
  width = "wide",
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  width?: "wide" | "content";
}) {
  return (
    <div className={cn("mx-auto w-full", width === "wide" ? "max-w-wide" : "max-w-content")}>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="t-eyebrow mb-2">{eyebrow}</p>}
          <h1 className="font-display text-display-lg text-ink">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-body-md text-ink-muted">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

/** Horizontal filter tabs that drive a URL query param, so a filtered view is
 *  shareable and the back button behaves. */
export function FilterTabs({
  options,
  active,
  basePath,
  param = "status",
}: {
  options: { value: string; label: string; count?: number }[];
  active: string;
  basePath: string;
  param?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-line pb-4">
      {options.map((o) => {
        const on = o.value === active;
        return (
          <Link
            key={o.value}
            href={`${basePath}?${param}=${o.value}`}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 font-label text-label-xs",
              "font-semibold uppercase tracking-[0.08em] transition-colors duration-fast",
              on
                ? "bg-editorial-bg text-editorial-fg"
                : "border border-line text-ink-muted hover:border-brand hover:text-brand",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tabular text-[10px]", on ? "opacity-70" : "text-ink-faint")}>
                {o.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

/** Table shell. Scrolls horizontally rather than letting the page do it —
 *  the full-bleed rule from the design system still applies here. */
export function DataTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap px-5 py-3 font-label text-[10px] font-semibold
                             uppercase tracking-[0.12em] text-ink-faint"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
      {empty && <EmptyRowsNotice />}
    </div>
  );
}

function EmptyRowsNotice() {
  return (
    <div className="dot-matrix border-t border-line py-16 text-center">
      <p className="text-body-md text-ink-muted">Nothing here yet.</p>
    </div>
  );
}

export function Td({
  children,
  className,
  mono,
}: {
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <td className={cn("px-5 py-3 text-body-sm text-ink", mono && "tabular", className)}>
      {children}
    </td>
  );
}

/** Empty state for a whole screen — distinct from an empty table. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="dot-matrix rounded-lg border border-line py-20 text-center">
      <p className="text-headline-sm text-ink">{title}</p>
      {body && <p className="mx-auto mt-2 max-w-md text-body-sm text-ink-muted">{body}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * A screen that exists in navigation but is not built yet.
 *
 * Deliberately explicit rather than a 404: an admin clicking a sidebar link
 * deserves to know the difference between "broken" and "not built yet", and
 * what to do in the meantime.
 */
export function NotBuiltYet({
  title,
  what,
  workaround,
}: {
  title: string;
  what: string;
  workaround?: string;
}) {
  return (
    <div className="panel dot-matrix p-10">
      <span className="inline-flex items-center gap-2 rounded-full border border-warn bg-warn-soft px-3 py-1 font-label text-label-xs font-bold uppercase tracking-[0.12em] text-warn-on-soft">
        Not built yet
      </span>
      <h2 className="mt-5 font-display text-headline-md text-ink">{title}</h2>
      <p className="mt-3 max-w-xl text-body-md text-ink-muted">{what}</p>
      {workaround && (
        <p className="mt-4 max-w-xl rounded-md border border-line bg-surface-1 px-4 py-3 text-body-sm text-ink-muted">
          <span className="font-medium text-ink">In the meantime: </span>
          {workaround}
        </p>
      )}
    </div>
  );
}

export function AdminButton({
  href,
  children,
  variant = "brand",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "brand" | "outline";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-full px-5 font-label text-label-xs",
        "font-semibold uppercase tracking-[0.08em] transition-all duration-fast ease-ease",
        variant === "brand"
          ? "bg-brand-fill text-brand-on shadow-brand hover:brightness-110"
          : "border border-line-strong text-ink hover:border-brand hover:text-brand",
      )}
    >
      {children}
    </Link>
  );
}
