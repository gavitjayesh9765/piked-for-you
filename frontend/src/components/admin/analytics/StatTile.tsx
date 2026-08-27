import Link from "next/link";

import { cn } from "@/lib/cn";
import type { Change } from "@/lib/admin-api";

/**
 * One number, and what it is doing.
 *
 * Shared by the dashboard and the analytics screen so a tile means the same
 * thing in both — the dashboard previously carried its own private `Metric`,
 * and two tile components on two screens is how "up 4%" ends up green on one
 * and grey on the other.
 */
export function StatTile({
  label,
  value,
  hint,
  change,
  /** Which direction is good. Views up is good; open messages up is not, and a
   *  tile that paints every rise green teaches the reader to stop reading it. */
  polarity = "up-is-good",
  tone = "neutral",
  href,
  children,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: Change;
  polarity?: "up-is-good" | "up-is-bad" | "neutral";
  tone?: "neutral" | "brand" | "value" | "warn" | "danger";
  href?: string;
  /** A sparkline, usually. Sits under the value. */
  children?: React.ReactNode;
  className?: string;
}) {
  const valueTone = {
    neutral: "text-ink",
    brand: "text-brand",
    value: "text-value",
    warn: "text-warn",
    danger: "text-danger",
  }[tone];

  const body = (
    <>
      <p className="t-eyebrow">{label}</p>
      <p className={cn("tabular mt-3 text-display-lg font-bold leading-none", valueTone)}>
        {value}
      </p>

      {children ? <div className="mt-3">{children}</div> : null}

      {change !== undefined ? <ChangeLabel change={change} polarity={polarity} /> : null}
      {hint ? <p className="mt-2 text-body-sm text-ink-subtle">{hint}</p> : null}
    </>
  );

  const shell = cn("panel p-5", href && "transition-colors duration-fast hover:border-brand-line", className);

  return href ? (
    <Link href={href} className={shell}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/**
 * The change against the previous equal-length period.
 *
 * ⚠ `null` IS A DISTINCT STATE AND MUST STAY ONE. It means the previous period
 * was zero, in which case there is no percentage change — 0 to 40 is not "up
 * 100%", it is not a ratio at all. Rendering it as +100%, as ∞, or as 0% all
 * state something the data does not, and the one that gets shipped by accident
 * is 0%, which reads as "flat" when the truth is "this is entirely new".
 */
function ChangeLabel({
  change,
  polarity,
}: {
  change: Change;
  polarity: "up-is-good" | "up-is-bad" | "neutral";
}) {
  if (change === null) {
    return <p className="mt-2 text-body-sm text-ink-faint">No prior period to compare</p>;
  }

  const flat = Math.abs(change) < 0.05;
  if (flat) {
    return <p className="mt-2 text-body-sm text-ink-subtle">Unchanged</p>;
  }

  const good =
    polarity === "neutral" ? null : polarity === "up-is-good" ? change > 0 : change < 0;

  const colour =
    good === null ? "text-ink-subtle" : good ? "text-value" : "text-danger";

  return (
    <p className={cn("tabular mt-2 text-body-sm", colour)}>
      {change > 0 ? "▲" : "▼"} {Math.abs(change).toLocaleString("en-IN")}%
      <span className="ml-1.5 text-ink-faint">vs previous</span>
    </p>
  );
}
