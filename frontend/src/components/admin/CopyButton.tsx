"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Copy to clipboard, with the two things a copy button usually gets wrong.
 *
 *   **It says whether it worked.** A button that looks identical before and
 *   after leaves you pressing it again to be sure, then pasting to check.
 *
 *   **It has a fallback.** `navigator.clipboard` is undefined outside a secure
 *   context, so on a plain-http staging host the modern API throws and the
 *   button silently does nothing. The offscreen-textarea route still works
 *   there, and this is a tool used on whatever host happens to be running.
 */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the textarea route */
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    // Off-screen rather than hidden: `display: none` is not selectable, and
    // `readOnly` stops mobile keyboards appearing for the instant it exists.
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    const ok = await writeClipboard(value);
    setState(ok ? "done" : "failed");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      // Announced, not just coloured — the change is the whole feedback.
      aria-live="polite"
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5",
        "font-label text-[10px] font-semibold uppercase tracking-[0.1em]",
        "transition-colors duration-fast",
        state === "done"
          ? "border-value-line bg-value-soft text-value-on-soft"
          : state === "failed"
            ? "border-danger-soft bg-danger-soft text-danger-on-soft"
            : "border-line text-ink-subtle hover:border-brand hover:text-brand",
        className,
      )}
    >
      {state === "done" ? "Copied" : state === "failed" ? "Press Ctrl+C" : label}
    </button>
  );
}

/**
 * A block of copyable text: the text, and a button that takes all of it.
 *
 * `whitespace-pre-wrap` rather than a horizontally scrolling `<pre>` — these
 * are prompts meant to be read before they are copied, and a prompt you have
 * to scroll sideways to read does not get read.
 */
export function CopyBlock({
  title,
  hint,
  value,
  tone = "default",
}: {
  title?: string;
  hint?: string;
  value: string;
  tone?: "default" | "quiet";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border",
        tone === "quiet" ? "border-line bg-surface-1" : "border-brand-line bg-surface-1",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          {title && <p className="t-eyebrow">{title}</p>}
          {hint && (
            <p className="mt-1 max-w-2xl text-label-xs leading-relaxed text-ink-faint">{hint}</p>
          )}
        </div>
        <CopyButton value={value} />
      </div>
      <pre className="max-h-[26rem] overflow-y-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[11px] leading-relaxed text-ink-muted">
        {value}
      </pre>
    </div>
  );
}
