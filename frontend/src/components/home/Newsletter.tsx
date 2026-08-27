"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { ApiError, subscribeToNewsletter } from "@/lib/api";
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

/**
 * What to tell someone whose signup did not go through.
 *
 * Every failure read "That didn't go through. Try again in a moment.", which
 * is wrong for the two cases that are not transient: a rejected address fails
 * identically however long you wait, and a rate limit needs a pause rather
 * than a retry. The status is real — it comes from the API through the proxy
 * in app/api/newsletter.
 */
function messageFor(err: unknown): string {
  if (!(err instanceof ApiError)) return "That didn't go through. Try again in a moment.";
  switch (err.status) {
    case 422:
      return "That address didn't look right — check it and try again.";
    case 429:
      return "That's a few too many tries in a short window. Give it a minute.";
    case 0:
    case 502:
    case 503:
    case 504:
      return "We couldn't reach the list just now. Nothing was saved — try again in a moment.";
    default:
      return err.message || "That didn't go through. Try again in a moment.";
  }
}

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState<NewsletterFrequency>("deals_only");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  /**
   * Whether a confirmation mail actually went out, per the API.
   *
   * Defaults true so the optimistic copy is what shows if an older API omits
   * the field — the same-day risk is telling someone to check an inbox, and
   * the reverse (staying quiet when a mail did arrive) is the cheaper mistake
   * only while nothing is being sent.
   */
  const [mailEnabled, setMailEnabled] = useState(true);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError(null);
    try {
      const res = await subscribeToNewsletter({ email: email.trim(), frequency });
      setMailEnabled(res.mailEnabled !== false);
      setState("done");
    } catch (err) {
      setState("error");
      setError(messageFor(err));
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
                {/* Two messages, because only one of them is ever true. The
                    first promises an email; saying that while the transport is
                    off sends a reader to an inbox to wait for something that
                    is not coming, and they conclude the site is broken. */}
                {mailEnabled ? (
                  <p className="text-body-md text-ink-muted">
                    We've sent a confirmation to{" "}
                    <span className="font-medium text-ink">{email}</span>. Click the link in it
                    and you're set — nothing arrives until you do.
                  </p>
                ) : (
                  <p className="text-body-md text-ink-muted">
                    <span className="font-medium text-ink">{email}</span> is on the list. The
                    newsletter hasn't started yet — we're still building up enough verdicts to
                    make one worth reading. When it does, your first email will be a confirmation
                    link, and nothing else is sent until you click it.
                  </p>
                )}
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
