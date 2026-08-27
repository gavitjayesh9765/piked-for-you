"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Per-message handling controls for the contact queue.
 *
 * The same shape as `ModerateActions` on the reviews screen, for the same
 * reason: these two screens are both queues, and an admin who has learnt one
 * should not have to learn the other. Statuses are laid out left to right in
 * the order a message actually moves through them.
 *
 * Everything goes through the `/admin/api/*` Route Handler rather than calling
 * the API directly — the access token is in an `httpOnly` cookie that client
 * JavaScript deliberately cannot read.
 */
const FLOW = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "answered", label: "Answered" },
  { value: "closed", label: "Closed" },
] as const;

export function MessageActions({
  id,
  status,
  note,
}: {
  id: string;
  status: string;
  note: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState(false);
  const [draft, setDraft] = useState(note ?? "");

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/admin/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.detail === "string" ? data.detail : "That didn't save.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("That didn't save.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-faint">
          Status
        </span>

        <div className="flex flex-wrap gap-1.5">
          {FLOW.map((s) => {
            const on = s.value === status;
            return (
              <button
                key={s.value}
                type="button"
                disabled={busy || on}
                onClick={() => patch({ status: s.value })}
                className={cn(
                  "rounded-full px-3 py-1.5 font-label text-label-xs font-semibold uppercase",
                  "tracking-[0.08em] transition-colors duration-fast",
                  on
                    ? "bg-editorial-bg text-editorial-fg"
                    : "border border-line text-ink-muted hover:border-brand hover:text-brand",
                  busy && !on && "opacity-45",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setEditingNote((v) => !v)}
          className="ml-auto font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle
                     transition-colors duration-fast hover:text-brand"
        >
          {note ? "Edit note" : "Add note"}
        </button>
      </div>

      {/* An internal note, never shown to the sender. Kept collapsed because
          most messages will never need one, and an always-open textarea under
          every card turns a queue into a wall of empty boxes. */}
      {editingNote && (
        <div className="mt-4">
          <label className="block">
            <span className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle">
              Internal note — not sent to anyone
            </span>
            <textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Who is handling this, and what happened."
              className="mt-2 w-full resize-y rounded-sm border border-line bg-surface-1 px-3 py-2
                         text-body-sm leading-relaxed text-ink outline-none transition-colors
                         duration-fast placeholder:text-ink-faint focus:border-brand-vivid"
            />
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (await patch({ internalNote: draft })) setEditingNote(false);
              }}
              className="inline-flex h-9 items-center rounded-full bg-brand-fill px-4 font-label
                         text-label-xs font-semibold uppercase tracking-[0.08em] text-brand-on
                         transition-all duration-fast hover:brightness-110 disabled:opacity-45"
            >
              {busy ? "Saving…" : "Save note"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(note ?? "");
                setEditingNote(false);
              }}
              className="font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle
                         hover:text-brand"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-body-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
