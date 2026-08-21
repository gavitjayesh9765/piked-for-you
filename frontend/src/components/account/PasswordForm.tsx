"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Change your password.
 *
 * This did not exist. `grep -rn "updateUser" src/` returned nothing, for
 * shoppers and admins alike, which had three consequences worth naming
 * because none of them are obvious from the missing UI alone:
 *
 *  1. Someone who believed their password was compromised had no way to
 *     rotate it. The only remedy was a support request.
 *  2. `ForgotPasswordForm` sent a reset link to `/account/settings` — a page
 *     with no password field. So the reset link was not a reset at all: it was
 *     a passwordless login, and the account owner had no way to invalidate the
 *     credential that had gone missing.
 *  3. There was no path to rotate an *admin* password either, and admin
 *     accounts hold aal2 sessions over the whole content surface.
 *
 * Supabase's `updateUser` is the whole mechanism: the password is hashed and
 * stored by the auth server, never by us, and never travels through our API.
 *
 * **Reauthentication.** Supabase can require a recently-verified session
 * before accepting a password change (the `secure_password_change` setting).
 * When it is on, a stale tab cannot silently change the password on a machine
 * someone walked away from. The error it returns for that case is surfaced
 * here rather than swallowed into a generic failure, because it is the one
 * error the person can actually act on — see `NEEDS_REAUTH`.
 */
const MIN_LENGTH = 10;

/** Supabase's wording for "this session is too old to do that". */
const NEEDS_REAUTH = /reauthentication|recent|aal|session/i;

export function PasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // A success message that never goes away reads as the current state of the
  // form rather than as something that just happened.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 8000);
    return () => clearTimeout(t);
  }, [done]);

  const tooShort = password.length > 0 && password.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && password !== confirm;
  const ready = password.length >= MIN_LENGTH && password === confirm && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;

    setBusy(true);
    setError(null);
    setDone(false);

    const supabase = createClient();
    const { error: err } = await supabase.auth.updateUser({ password });

    if (err) {
      setError(
        NEEDS_REAUTH.test(err.message)
          ? "For your security, sign in again before changing your password."
          : // Everything else is reported generically. Supabase's raw message
            // can describe policy internals, and none of it helps here.
            "Could not update the password. Choose a different one and try again.",
      );
      setBusy(false);
      return;
    }

    // Cleared immediately on success — a new password sitting in a form field
    // behind an unlocked screen is the thing this whole feature exists for.
    setPassword("");
    setConfirm("");
    setDone(true);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate className="panel max-w-prose p-5">
      <h3 className="text-headline-sm text-ink">Change password</h3>
      <p className="mt-2 text-body-sm text-ink-muted">
        Your other signed-in devices stay signed in. If you are changing this because someone
        else may have had access, sign out everywhere afterwards from the account menu.
      </p>

      <label className="mt-6 block">
        <span className="t-eyebrow">New password</span>
        <input
          type="password"
          required
          minLength={MIN_LENGTH}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={tooShort || undefined}
          className={inputCls}
        />
        <span className="mt-2 block text-label-xs text-ink-faint">
          At least {MIN_LENGTH} characters. Longer is better than complicated.
        </span>
      </label>

      <label className="mt-5 block">
        <span className="t-eyebrow">Confirm new password</span>
        <input
          type="password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={mismatch || undefined}
          className={inputCls}
        />
        {mismatch && (
          <span className="mt-2 block text-label-xs text-danger">
            These two do not match.
          </span>
        )}
      </label>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-md border border-danger-soft bg-danger-soft px-4 py-3
                     text-body-sm text-danger-on-soft"
        >
          {error}
        </p>
      )}

      {done && (
        <p
          role="status"
          className="mt-5 rounded-md border border-value-soft bg-value-soft px-4 py-3
                     text-body-sm text-value-on-soft"
        >
          Password updated.
        </p>
      )}

      <button
        type="submit"
        disabled={!ready}
        className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-brand-fill
                   px-6 font-label text-label font-semibold uppercase tracking-[0.08em]
                   text-brand-on shadow-brand transition-all duration-fast ease-ease
                   hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
      >
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}

const inputCls =
  "mt-2 h-12 w-full rounded-md border border-line bg-surface-0 px-4 text-body-md text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";
