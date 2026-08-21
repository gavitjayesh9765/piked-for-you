"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Approve or reject one review attachment (spec §29).
 *
 * Rejecting deletes the object from storage as well as marking the row —
 * leaving a rejected file reachable by signed URL would defeat the point.
 */
export function MediaModerateActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [state, setState] = useState(status);

  async function act(action: "approve" | "reject") {
    setBusy(action);
    const res = await fetch(`/admin/api/user-media/${id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const d = await res.json();
      setState(d.moderationStatus);
      router.refresh();
    }
    setBusy(null);
  }

  if (state === "approved") {
    return (
      <span className="font-label text-label-xs uppercase tracking-[0.1em] text-value">
        Approved
      </span>
    );
  }
  if (state === "rejected") {
    return (
      <span className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
        Rejected · file deleted
      </span>
    );
  }

  return (
    <div className="flex gap-2">
      {(["approve", "reject"] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => void act(a)}
          disabled={busy !== null}
          className={cn(
            "h-8 flex-1 rounded-full border font-label text-label-xs font-semibold uppercase",
            "tracking-[0.1em] transition-colors duration-fast disabled:opacity-45",
            a === "approve"
              ? "border-value-line text-value hover:bg-value-soft"
              : "border-line text-ink-muted hover:border-danger hover:text-danger",
          )}
        >
          {busy === a ? "\u2026" : a === "approve" ? "Approve" : "Reject"}
        </button>
      ))}
    </div>
  );
}
