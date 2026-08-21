"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Moderation controls (spec §30).
 *
 * Rejecting asks for a reason before it fires. Not a confirmation dialogue for
 * its own sake — the note lands in the audit log, and "why was this rejected"
 * is the question that actually gets asked three months later.
 */
export function ModerateActions({
  id,
  status,
  isFeatured,
}: {
  id: string;
  status: string;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: string, withNote?: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/admin/api/reviews/${id}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: withNote }),
      });
      if (!res.ok) {
        setError("That didn't work.");
        return;
      }
      setAsking(false);
      setNote("");
      router.refresh();
    } catch {
      setError("That didn't work.");
    } finally {
      setBusy(null);
    }
  }

  if (asking) {
    return (
      <div className="rounded-md border border-line bg-surface-1 p-4">
        <label className="block">
          <span className="t-eyebrow">Reason for rejecting</span>
          <textarea
            autoFocus
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Recorded in the audit log."
            className="mt-2 w-full resize-y rounded-md border border-line bg-surface-0 px-3 py-2
                       text-body-sm text-ink outline-none focus:border-brand-vivid"
          />
        </label>
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => act("reject", note.trim() || undefined)}
            className="h-9 rounded-full bg-danger-fill px-5 font-label text-label-xs font-semibold
                       uppercase tracking-[0.1em] text-danger-on disabled:opacity-45"
          >
            {busy ? "…" : "Confirm reject"}
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status !== "approved" && (
        <Action onClick={() => act("approve")} busy={busy === "approve"} tone="value">
          Approve
        </Action>
      )}
      {status !== "rejected" && (
        <Action onClick={() => setAsking(true)} tone="danger">
          Reject
        </Action>
      )}
      {status === "approved" && (
        <Action
          onClick={() => act(isFeatured ? "unfeature" : "feature")}
          busy={busy === "feature" || busy === "unfeature"}
          tone="brand"
        >
          {isFeatured ? "Unfeature" : "Feature"}
        </Action>
      )}
      {status !== "hidden" && (
        <Action onClick={() => act("hide")} busy={busy === "hide"} tone="muted">
          Hide
        </Action>
      )}
      {error && (
        <span role="alert" className="text-label-xs text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

function Action({
  onClick,
  busy,
  tone,
  children,
}: {
  onClick: () => void;
  busy?: boolean;
  tone: "value" | "danger" | "brand" | "muted";
  children: React.ReactNode;
}) {
  const tones = {
    value: "border-value-line text-value hover:bg-value-soft",
    danger: "border-line text-ink-muted hover:border-danger hover:text-danger",
    brand: "border-brand-line text-brand hover:bg-brand-soft",
    muted: "border-line text-ink-subtle hover:text-ink",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={cn(
        "h-9 rounded-full border px-5 font-label text-label-xs font-semibold uppercase",
        "tracking-[0.1em] transition-colors duration-fast disabled:opacity-45",
        tones,
      )}
    >
      {busy ? "…" : children}
    </button>
  );
}
