import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * The button variants ARE the colour grammar (docs/01-design-brainstorm.md §2):
 *
 *   brand   — DECIDING. Internal platform actions. Purple.
 *   retail  — GETTING.  Outbound to Amazon/Flipkart. Orange. Nothing else.
 *   ghost / outline / subtle — structural, no accent meaning.
 *
 * `retail` is intentionally hard to reach: it is exported only through
 * <RetailButton>, so an orange button cannot drift onto an internal control.
 */
type Variant = "brand" | "ghost" | "outline" | "subtle" | "editorial";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-label font-semibold " +
  "tracking-[0.06em] uppercase whitespace-nowrap select-none " +
  "transition-all duration-fast ease-ease " +
  "disabled:opacity-45 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  brand:
    "bg-brand-fill text-brand-on rounded-full shadow-brand " +
    "hover:brightness-110 active:brightness-95",
  editorial:
    "bg-editorial-bg text-editorial-fg rounded-full " +
    "hover:opacity-90 active:opacity-80",
  outline:
    "border border-line-strong text-ink rounded-full bg-transparent " +
    "hover:border-brand hover:text-brand",
  subtle:
    "bg-surface-2 text-ink rounded-full border border-transparent " +
    "hover:bg-surface-3",
  ghost:
    "text-ink-muted rounded-full bg-transparent hover:text-brand",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-label-xs",
  md: "h-11 px-6 text-label",
  lg: "h-14 px-8 text-label",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = "brand",
  size = "md",
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<"button">) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "brand",
  size = "md",
  fullWidth,
  className,
  children,
  ...rest
}: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(base, variants[variant], sizes[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {children}
    </Link>
  );
}

/**
 * The ONLY orange control in the system. Always leaves the site, so it always
 * carries rel="sponsored noopener" (spec §7 affiliate model) and an explicit
 * external-link affordance — the user should never be surprised to land on
 * Amazon.
 */
export function RetailButton({
  retailer,
  href,
  price,
  emphasis = "primary",
  className,
}: {
  retailer: string;
  href: string;
  price?: string;
  emphasis?: "primary" | "secondary";
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={cn(
        base,
        sizes.lg,
        "rounded-sm w-full justify-between",
        emphasis === "primary"
          ? "bg-retail-fill text-retail-on hover:brightness-110"
          : "border border-retail-line text-retail bg-retail-soft hover:border-retail",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        View on {retailer}
        <ExternalGlyph />
      </span>
      {price ? <span className="tabular text-body-sm normal-case tracking-normal">{price}</span> : null}
    </a>
  );
}

function ExternalGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 3h7v7M13 3 5 11M11 9v3.5A1.5 1.5 0 0 1 9.5 14h-6A1.5 1.5 0 0 1 2 12.5v-6A1.5 1.5 0 0 1 3.5 5H7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
