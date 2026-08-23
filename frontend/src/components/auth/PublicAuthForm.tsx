"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { safePublicPath } from "@/lib/safe-path";
import { asError, authErrorMessage } from "@/lib/auth-errors";

/**
 * Public sign-in / sign-up for shoppers (spec §27).
 *
 * Entirely separate from the admin door. Nothing here can grant the admin role
 * — `app_metadata` is not writable by the client SDK, so a crafted signup
 * payload has nothing to target.
 *
 * Both modes return **uniform messages**: sign-in never distinguishes "no such
 * account" from "wrong password", and sign-up reports success even for an
 * address already registered. Otherwise either form becomes an oracle for
 * testing whether someone has an account here.
 *
 * Google sign-in sits alongside the password form and is the same door: it
 * lands on `/auth/callback` and produces an ordinary shopper session with no
 * `app_metadata` role, exactly like a password signup. Supabase links a Google
 * identity to an existing account only when the provider asserts the *same
 * verified email*, so "sign up with Google" and "sign up with a password" on
 * one address converge on one profile rather than forking into two.
 */
type Mode = "login" | "register";

export function PublicAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  /**
   * Why they were sent here, if something sent them.
   *
   * `/auth/callback` redirects to `/login?error=invalid_link` when a
   * confirmation link is spent or expired, and nothing rendered it — so the
   * most common recoverable failure in the whole flow arrived as a blank sign-in
   * form. Not held in state: it describes how this page was reached, and a
   * failed submit below should replace it rather than stack under it.
   */
  const notice = asError(error) ?? authErrorMessage(params.get("error"));

  const isRegister = mode === "register";

  /**
   * Same-origin paths only, and never an admin route.
   *
   * This used to be a hand-rolled `startsWith("/") && !startsWith("//")` test.
   * That rejects the obvious `//evil.example` and misses `/\evil.example`,
   * which browsers normalise to a protocol-relative URL — so
   * `router.replace()` resolved it against the current origin and left the
   * site. `safePublicPath` resolves the value the way the browser will and
   * keeps it only if it still points here; see lib/safe-path.ts.
   */
  function safeNext(): string {
    return safePublicPath(params.get("next"), "/");
  }

  /**
   * Hand off to Google.
   *
   * The provider returns to `/auth/callback`, the same route the email
   * confirmation link already uses — it exchanges the one-time `code` for a
   * session **server-side** and re-validates `next` before redirecting. So the
   * only new surface here is the button; the landing side was already built
   * and already hardened.
   *
   * `prompt: "select_account"` stops Google silently reusing whichever account
   * the browser signed into last. On a shared machine that quietly attaches a
   * review to the wrong person, and there is no obvious way back from it.
   */
  async function signInWithGoogle() {
    setOauthBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          safeNext(),
        )}`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (err) {
      setError("Could not start sign-in with Google. Try again, or use your email address.");
      setOauthBusy(false);
      return;
    }
    // On success the browser is navigating to Google. Leave `oauthBusy` set so
    // the button stays disabled for however long that takes.
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();

    if (isRegister) {
      const { error: err } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Goes to user_metadata, which is user-writable — which is exactly
          // why nothing in this codebase reads it for authorization.
          data: { display_name: displayName.trim() },
          // Thread the destination through the confirmation email. Without
          // this the callback has no `next` to read and every newly confirmed
          // account lands on the homepage, however specific the page they were
          // on when they signed up. The callback re-validates it as a
          // same-origin, non-admin path before using it.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            safeNext(),
          )}`,
        },
      });

      // Even on error we show the same confirmation screen: a distinct
      // "already registered" message would leak who has an account.
      if (err && !/already/i.test(err.message)) {
        setError("Could not create the account. Check the details and try again.");
        setBusy(false);
        return;
      }
      setSent(true);
      setBusy(false);
      return;
    }

    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (err) {
      setError("Those credentials were not accepted.");
      setBusy(false);
      return;
    }

    router.replace(safeNext());
    router.refresh();
  }

  if (sent) {
    return (
      <div className="panel p-8">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-value-soft text-value-on-soft">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m4 12.5 5 5L20 6.5" />
          </svg>
        </span>
        <h2 className="mt-5 text-headline-sm text-ink">Check your inbox</h2>
        <p className="mt-2 text-body-md text-ink-muted">
          If that address can be registered, we&apos;ve sent a confirmation link to{" "}
          <span className="font-medium text-ink">{email}</span>. Click it to finish setting
          up your account.
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-8">
      <h1 className="font-display text-headline-md text-ink">
        {isRegister ? "Create an account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-body-sm text-ink-muted">
        {isRegister
          ? "You only need an account to write reviews and upload photos. Browsing stays open to everyone."
          : "Sign in to write reviews and manage your review history."}
      </p>

      {/* Google first: for most shoppers it is one tap and no password to
          choose, and burying it under the form makes them type one anyway. */}
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={busy || oauthBusy}
        className="mt-8 inline-flex h-12 w-full items-center justify-center gap-3 rounded-full
                   border border-line bg-surface-0 text-body-md font-medium text-ink
                   transition-colors duration-fast ease-ease
                   hover:border-ink-faint disabled:pointer-events-none disabled:opacity-45"
      >
        <GoogleMark />
        {oauthBusy ? "Redirecting…" : isRegister ? "Sign up with Google" : "Continue with Google"}
      </button>

      <div className="mt-6 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />
        <span className="text-label-xs uppercase tracking-[0.08em] text-ink-faint">or</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={submit} noValidate className="mt-6">
        {isRegister && (
          <label className="block">
            <span className="t-eyebrow">Display name</span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={80}
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Shown on your reviews"
              className={inputCls}
            />
          </label>
        )}

        <label className={cn("block", isRegister && "mt-5")}>
          <span className="t-eyebrow">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
        </label>

        <label className="mt-5 block">
          <span className="t-eyebrow flex items-center justify-between">
            Password
            {!isRegister && (
              <Link
                href="/forgot-password"
                className="font-normal normal-case tracking-normal text-brand hover:underline"
              >
                Forgot?
              </Link>
            )}
          </span>
          <input
            type="password"
            required
            minLength={isRegister ? 10 : undefined}
            autoComplete={isRegister ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
          />
          {isRegister && (
            <span className="mt-2 block text-label-xs text-ink-faint">
              At least 10 characters. Longer is better than complicated.
            </span>
          )}
        </label>

        {notice && (
          <p
            // `alert` only for failures. An informational notice announced as
            // an alert interrupts a screen-reader user to tell them nothing is
            // wrong, which is its own small harm.
            role={notice.tone === "error" ? "alert" : "status"}
            className={cn(
              "mt-5 rounded-md border px-4 py-3 text-body-sm",
              notice.tone === "error"
                ? "border-danger-soft bg-danger-soft text-danger-on-soft"
                : "border-line bg-surface-2 text-ink-muted",
            )}
          >
            {notice.message}
          </p>
        )}

        {/* The account creation flow linked neither document. Both the terms
            and the privacy policy exist, the settings page points people at
            them as "the rules that apply to this account", and the one moment
            that actually forms the agreement said nothing. Shown for Google
            signup too — that path has no other step in which to say it. */}
        {isRegister && (
          <p className="mt-6 text-body-sm text-ink-subtle">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-brand hover:underline">
              terms of service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-brand hover:underline">
              privacy policy
            </Link>
            .
          </p>
        )}

        <button
          type="submit"
          disabled={
            busy || oauthBusy || !email || !password || (isRegister && displayName.trim().length < 2)
          }
          className={cn(
            isRegister ? "mt-5" : "mt-8",
            `inline-flex h-12 w-full items-center justify-center rounded-full
                     bg-brand-fill font-label text-label font-semibold uppercase tracking-[0.08em]
                     text-brand-on shadow-brand transition-all duration-fast ease-ease
                     hover:brightness-110 disabled:pointer-events-none disabled:opacity-45`,
          )}
        >
          {busy ? "Please wait…" : isRegister ? "Create account" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-body-sm text-ink-muted">
        {isRegister ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-brand hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/register" className="text-brand hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Google's four-colour "G", inlined.
 *
 * Their branding terms require the official mark rather than a redrawn or
 * recoloured one, and it must keep its own colours — so this is the one icon
 * on the site that deliberately ignores `currentColor`. Inlined rather than
 * fetched so a blocked request cannot leave the button wordless.
 */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
    </svg>
  );
}

const inputCls =
  "mt-2 h-12 w-full rounded-md border border-line bg-surface-0 px-4 text-body-md text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";
