"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";

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
 */
type Mode = "login" | "register";

export function PublicAuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const isRegister = mode === "register";

  function safeNext(): string {
    const raw = params.get("next");
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
    // Never let a public login land someone on an admin route.
    if (raw.startsWith("/admin")) return "/";
    return raw;
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

      <form onSubmit={submit} noValidate className="mt-8">
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

        {error && (
          <p role="alert" className="mt-5 rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !email || !password || (isRegister && displayName.trim().length < 2)}
          className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-full
                     bg-brand-fill font-label text-label font-semibold uppercase tracking-[0.08em]
                     text-brand-on shadow-brand transition-all duration-fast ease-ease
                     hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
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

const inputCls =
  "mt-2 h-12 w-full rounded-md border border-line bg-surface-0 px-4 text-body-md text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";
