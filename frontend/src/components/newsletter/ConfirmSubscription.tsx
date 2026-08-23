"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { confirmNewsletterSubscription, ApiError } from "@/lib/api";

/**
 * Completes double opt-in for the token in the confirmation email.
 *
 * WHY THIS RUNS IN THE BROWSER AND NOT ON THE SERVER
 * --------------------------------------------------
 * Confirming is a write, and the API clears the token on success so the link
 * is single-use (see the note on `confirm()` in the backend router). Corporate
 * mail gateways and inbox link-scanners fetch every URL in an incoming message
 * before the recipient ever sees it. Server-rendering the confirmation would
 * hand the scanner the one use, and the person who actually clicks would then
 * be told their link is no longer valid — a failure that looks like a bug in
 * the email and is invisible on our side.
 *
 * Scanners do not execute JavaScript. Confirming from `useEffect` keeps the
 * flow one click while making the prefetch harmless.
 */
export function ConfirmSubscription({ token }: { token: string | null }) {
  const [state, setState] = useState<"working" | "done" | "expired" | "error">("working");

  // React runs effects twice in development StrictMode. A second call with a
  // token the first one just consumed returns 404, which would render
  // "expired" over a confirmation that actually succeeded.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    confirmNewsletterSubscription(token)
      .then(() => setState("done"))
      .catch((err) => setState(err instanceof ApiError && err.status === 404 ? "expired" : "error"));
  }, [token]);

  if (!token) return <Panel {...COPY.missing} />;
  if (state === "working") return <Panel {...COPY.working} busy />;
  return <Panel {...COPY[state]} />;
}

type PanelCopy = { eyebrow: string; heading: string; body: string; cta?: "home" | "retry" };

const COPY: Record<"working" | "done" | "expired" | "error" | "missing", PanelCopy> = {
  working: {
    eyebrow: "Newsletter",
    heading: "Confirming…",
    body: "One moment while we add you to the list.",
  },
  done: {
    eyebrow: "Newsletter",
    heading: "You're on the list.",
    body: "That's it — your subscription is confirmed. Every email we send carries a one-click unsubscribe, and you can change how often we show up from the same link.",
    cta: "home",
  },
  expired: {
    eyebrow: "Newsletter",
    heading: "That link is no longer valid.",
    body: "Confirmation links work once and expire after 24 hours. Subscribe again from the homepage and we'll send a fresh one.",
    cta: "home",
  },
  error: {
    eyebrow: "Newsletter",
    heading: "That didn't go through.",
    body: "Something on our side failed, not your link. Give it a moment and try again — the link is still good.",
    cta: "retry",
  },
  missing: {
    eyebrow: "Newsletter",
    heading: "Nothing to confirm.",
    body: "This page needs the link from your confirmation email. Open that email and click the button inside it.",
    cta: "home",
  },
};

function Panel({ eyebrow, heading, body, cta, busy }: PanelCopy & { busy?: boolean }) {
  return (
    <div
      className="rounded-2xl border border-line bg-surface-1 p-8 lg:p-10"
      // Screen readers get told the outcome once it lands, rather than being
      // left on "Confirming…" — the state swaps without any navigation.
      aria-live="polite"
      aria-busy={busy ?? false}
    >
      <p className="t-eyebrow mb-3">{eyebrow}</p>
      <h1 className="t-headline text-ink">{heading}</h1>
      <p className="mt-4 text-body-lg text-ink-muted">{body}</p>

      {cta === "home" && (
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-full bg-value px-6 py-3 font-label text-label-sm uppercase tracking-[0.08em] text-on-value transition-colors hover:bg-value-strong"
        >
          Back to PickDForYou
        </Link>
      )}
      {cta === "retry" && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-8 inline-flex items-center justify-center rounded-full bg-value px-6 py-3 font-label text-label-sm uppercase tracking-[0.08em] text-on-value transition-colors hover:bg-value-strong"
        >
          Try again
        </button>
      )}
    </div>
  );
}
