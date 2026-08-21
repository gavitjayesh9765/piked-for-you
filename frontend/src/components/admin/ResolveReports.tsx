"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Mark every open report on a review as handled.
 *
 * Separate from moderating the review itself — deciding a report is unfounded
 * is a real outcome, and should not require changing the review.
 */
export function ResolveReports({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function resolve() {
    setBusy(true);
    const res = await fetch(`/admin/api/reports/${reviewId}/resolve`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) return <span className="text-body-sm text-value">Resolved.</span>;

  return (
    <button
      type="button"
      onClick={resolve}
      disabled={busy}
      className="h-9 rounded-full border border-value-line px-5 font-label text-label-xs
                 font-semibold uppercase tracking-[0.1em] text-value transition-colors
                 duration-fast hover:bg-value-soft disabled:opacity-45"
    >
      {busy ? "\u2026" : "Dismiss reports"}
    </button>
  );
}
