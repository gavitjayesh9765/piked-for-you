"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/cn";
import { isTerminal, type PriceRun } from "@/lib/pricing";

/**
 * Re-check one product's prices, from its edit screen.
 *
 * The same machinery as the bulk button, scoped to a single product — and it
 * runs whatever the product's status is, because a draft is exactly when an
 * editor wants to know whether the price they typed is still right.
 *
 * Polls until the run settles, then refreshes the page so the retailer rows
 * above it show what changed. Two or three links is a few seconds of work, so
 * there is no separate progress screen for it.
 */
export function RefreshPriceButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [run, setRun] = useState<PriceRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function poll(runId: string, attempt = 0) {
    // ~2 minutes at 2s. A single product that has not finished by then is
    // stuck behind something, and the pricing screen is the place to see why.
    if (attempt > 60) {
      setError("Still running. Check Pricing for the details.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch(`/admin/api/pricing/runs/${runId}?status=all&limit=10`);
      if (res.ok) {
        const body = await res.json();
        setRun(body.run);

        if (isTerminal(body.run.status)) {
          setBusy(false);
          router.refresh();
          return;
        }
      }
    } catch {
      /* transient — keep polling */
    }

    timer.current = setTimeout(() => poll(runId, attempt + 1), 2000);
  }

  async function refresh() {
    setBusy(true);
    setError(null);
    setRun(null);

    try {
      const res = await fetch(`/admin/api/products/${productId}/refresh-price`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          typeof body?.detail === "string"
            ? body.detail
            : "Could not start the check. Try again in a moment.",
        );
        setBusy(false);
        return;
      }

      setRun(body);
      void poll(body.id);
    } catch {
      setError("Could not reach the API.");
      setBusy(false);
    }
  }

  const finished = run && isTerminal(run.status);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={refresh}
        disabled={busy}
        className={cn(
          "inline-flex h-9 items-center rounded-full border border-line-strong px-4",
          "font-label text-label-xs font-semibold uppercase tracking-[0.08em] text-ink",
          "transition-colors duration-fast hover:border-brand hover:text-brand",
          "disabled:pointer-events-none disabled:opacity-45",
        )}
      >
        {busy ? "Checking…" : "Check prices now"}
      </button>

      {error ? (
        <span role="alert" className="text-body-sm text-danger">
          {error}
        </span>
      ) : finished && run ? (
        <span className="text-body-sm text-ink-muted">
          {run.updatedCount > 0 ? (
            <span className="text-value">
              {run.updatedCount} price{run.updatedCount === 1 ? "" : "s"} updated.
            </span>
          ) : run.failedCount > 0 ? (
            <span className="text-danger">
              {run.failedCount} link{run.failedCount === 1 ? "" : "s"} could not be read —
              see the status on each row.
            </span>
          ) : (
            "No change — every price is already current."
          )}
        </span>
      ) : busy ? (
        <span className="text-label-xs text-ink-faint">
          Fetching each retailer page. This takes a few seconds.
        </span>
      ) : null}
    </div>
  );
}
