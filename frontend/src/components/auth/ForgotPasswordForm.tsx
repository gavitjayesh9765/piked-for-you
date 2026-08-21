"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Password reset request (spec §27).
 *
 * Follows the same rule as the sign-in form: the response is identical whether
 * or not the address has an account here. Anything else turns this box into an
 * oracle for testing who is registered — and a reset form is the easiest one to
 * probe, because it needs no password to try.
 *
 * That is also why the failure branch is silent. If Supabase rejects the call
 * for rate limiting or an unknown address, the confirmation still renders; the
 * only errors surfaced are ones the person can actually act on, like an address
 * that is not an address.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    const address = email.trim();
    if (!address || !address.includes("@")) {
      setError("Enter the email address you signed up with.");
      return;
    }

    setBusy(true);
    setError(null);

    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(address, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/settings`,
    });

    // Deliberately not branching on the result — see the note above.
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div>
        <p className="t-eyebrow mb-4">Check your inbox</p>
        <h1 className="t-headline text-ink">If that address has an account, a link is on its way.</h1>
        <p className="mt-5 text-body-md text-ink-muted">
          We sent a password reset link to <span className="text-ink">{email.trim()}</span>. It
          expires in an hour. If nothing arrives, check spam — and confirm you used the address you
          signed up with.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 font-label text-label font-semibold
                       uppercase tracking-[0.08em] text-ink transition-colors duration-fast hover:text-brand"
          >
            <span aria-hidden="true">←</span>
            Back to sign in
          </Link>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="font-label text-label font-semibold uppercase tracking-[0.08em]
                       text-ink-subtle transition-colors duration-fast hover:text-brand"
          >
            Use a different address
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="t-eyebrow mb-4">Account</p>
      <h1 className="t-headline text-ink">Reset your password.</h1>
      <p className="mt-5 text-body-md text-ink-muted">
        Enter the address you signed up with and we will send you a link to set a new password.
      </p>

      <form onSubmit={submit} noValidate className="mt-10">
        <label htmlFor="reset-email" className="t-label text-ink">
          Email address
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "reset-error" : undefined}
          className="mt-2 h-12 w-full rounded-md border border-line bg-surface-0 px-4 text-body-md
                     text-ink outline-none transition-colors duration-fast
                     placeholder:text-ink-faint focus:border-brand-vivid"
          placeholder="you@example.com"
        />

        {error ? (
          <p id="reset-error" role="alert" className="mt-3 text-body-sm text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-7 h-12 w-full rounded-full bg-brand-fill px-6 font-label text-label
                     font-semibold uppercase tracking-[0.08em] text-brand-on-fill
                     transition-opacity duration-fast hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Please wait…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-body-sm text-ink-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
