"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { subscribeToNewsletter } from "@/lib/api";
import type { NewsletterFrequency } from "@/lib/types";

/**
 * Newsletter signup.
 *
 * The frequency choice is the point. A research site that emails daily when the
 * reader wanted "only when it's genuinely worth it" trains them to ignore it, so
 * cadence is a first-class field rather than a preference buried in an account
 * page — and `deals_only` is the honest default for most people.
 *
 * No pre-ticked consent, no dark patterns: the value exchange is stated plainly
 * and unsubscribing is named up front.
 */
const OPTIONS: { value: NewsletterFrequency; label: string; hint: string }[] = [
  { value: "daily", label: "Daily", hint: "Every new verdict, as we publish it" },
  { value: "weekly", label: "Weekly", hint: "One digest, the week's best picks" },
  { value: "deals_only", label: "Only when it matters", hint: "Just genuinely good price drops" },
];

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<NewsletterFrequency>("deals_only");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      await subscribeToNewsletter({ email: email.trim(), frequency });
      setState("done");
    } catch {
      setState("error");
      setError("That didn't go through. Try again in a moment.");
    }
  }

  return (
    <section className="mt-section border-y border-line bg-surface-1">
      <div className="shell-wide py-16 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
          {/* --- Pitch --- */}
          <div className="max-w-xl">
            <p className="t-eyebrow mb-3">Stay in the loop</p>
            <h2 className="t-headline text-ink">Intelligence, delivered.</h2>
            <p className="mt-4 text-body-lg text-ink-muted">
              Get our verdicts before you need them. No sponsored placements, no filler — and you
              choose how often we're allowed to show up.
            </p>
            <p className="mt-5 flex items-center gap-2 font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle">
              <span className="inline-block h-px w-6 bg-value" />
              Unsubscribe in one click, any time
            </p>
          </div>

          {/* --- Form --- */}
          <div className="panel dot-matrix p-6 lg:p-8">
            {state === "done" ? (
              <div className="flex flex-col items-start gap-3 py-6">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-value-soft text-value-on-soft">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                </span>
                <h3 className="text-headline-sm text-ink">You're in.</h3>
                <p className="text-body-md text-ink-muted">
                  We've sent a confirmation to <span className="font-medium text-ink">{email}</span>.
                  Click the link in it and you're set — nothing arrives until you do.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setState("idle");
                    setEmail("");
                  }}
                  className="mt-1 font-label text-label-xs uppercase tracking-[0.1em] text-brand hover:underline"
                >
                  Use a different address
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <fieldset>
                  <legend className="t-eyebrow mb-4">How often?</legend>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {OPTIONS.map((opt) => {
                      const selected = frequency === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={cn(
                            "flex cursor-pointer flex-col gap-1 rounded-md border p-3.5 transition-all duration-fast ease-ease",
                            selected
                              ? "border-brand-line bg-brand-soft"
                              : "border-line bg-surface-0 hover:border-line-strong",
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="frequency"
                              value={opt.value}
                              checked={selected}
                              onChange={() => setFrequency(opt.value)}
                              className="h-3.5 w-3.5 shrink-0 accent-[var(--c-brand-fill)]"
                            />
                            <span
                              className={cn(
                                "font-label text-label font-semibold uppercase tracking-[0.06em]",
                                selected ? "text-brand-on-soft" : "text-ink",
                              )}
                            >
                              {opt.label}
                            </span>
                          </span>
                          <span className="text-label-xs leading-snug text-ink-subtle">{opt.hint}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <label className="flex-1">
                    <span className="sr-only">Email address</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="h-14 w-full rounded-full border border-line bg-surface-0 px-5 text-body-md
                                 text-ink outline-none transition-colors duration-fast
                                 placeholder:text-ink-faint focus:border-brand-vivid"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={state === "loading" || email.trim().length < 4}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-brand-fill
                               px-8 font-label text-label font-semibold uppercase tracking-[0.06em]
                               text-brand-on shadow-brand transition-all duration-fast ease-ease
                               hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
                  >
                    {state === "loading" ? "Subscribing…" : "Subscribe"}
                  </button>
                </div>

                {error && (
                  <p role="alert" className="mt-3 text-body-sm text-danger">
                    {error}
                  </p>
                )}

                <p className="mt-4 text-label-xs leading-relaxed text-ink-faint">
                  We'll email you a confirmation link first — nothing is sent until you click it. We
                  never sell your address, and every email carries a one-click unsubscribe.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
