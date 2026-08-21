"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-path";
import { recordAdminSignIn } from "@/lib/sign-in-event";

/**
 * Verify an **already enrolled** TOTP factor, lifting this session to aal2.
 *
 * This exists because without it there was a dead end. An admin who signed in,
 * reached the code step and closed the tab still held a valid aal1 session
 * with a verified factor attached. On the next visit the proxy routes any aal1
 * admin to /admin/security — which, seeing a verified factor, rendered
 * "Two-factor authentication is on" and nothing else. No code field, no
 * challenge, every other admin route refusing them, and no hint anywhere that
 * signing out and back in was the only way forward.
 *
 * Enrolment cannot serve that case: the factor already exists, and re-enrolling
 * is both wrong and refused. What an aal1 session with a factor needs is a
 * *challenge*, which is what this is — the same two calls the login form makes,
 * reachable from the one page such a session is allowed to open.
 *
 * Note what this does NOT do: it never falls back to enrolment when the
 * challenge fails. An aal1 session that cannot answer its own factor must stay
 * at aal1 — quietly offering to enrol a fresh one instead would turn a failed
 * second factor into a way around having one.
 */
export function MfaChallenge({ email }: { email: string | null }) {
  const router = useRouter();
  const params = useSearchParams();

  /** Where the proxy was taking them before the second factor interrupted. */
  function safeNext(): string {
    return safeInternalPath(params.get("next"), "/admin");
  }

  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;

      if (listError) {
        setError("Could not load your authentication factors. Reload to try again.");
        setReady(true);
        return;
      }

      // First verified TOTP factor, matching how the sign-in form picks one.
      const totp = data?.totp?.find((f) => f.status === "verified");
      if (!totp) {
        // The page only renders this component when a verified factor exists,
        // so this means it was removed between the server render and now.
        setError("No verified authenticator found. Reload this page.");
        setReady(true);
        return;
      }

      setFactorId(totp.id);
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challenge) {
      setError("Could not start verification. Try again.");
      setBusy(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    if (verifyError) {
      // Uniform message. Never distinguish "wrong code" from "expired
      // challenge" — the difference is only useful to someone guessing.
      setError("That code was not accepted. Check your device clock is correct.");
      setCode("");
      setBusy(false);
      return;
    }

    // Verifying promotes the session to aal2. Refresh so the server re-reads
    // the new claims, then send them where they were trying to go — which is
    // the whole point of the `next` the proxy attached on the way in.
    setBusy(false);
    recordAdminSignIn();

    router.replace(safeNext());
    router.refresh();
  }

  return (
    <div className="panel p-8">
      <h2 className="text-headline-sm text-ink">Enter your two-factor code</h2>
      <p className="mt-2 text-body-sm text-ink-muted">
        This session was signed in with a password only. Enter the 6-digit code from your
        authenticator app to finish signing in
        {email ? (
          <>
            {" as "}
            <span className="font-medium text-ink">{email}</span>
          </>
        ) : null}
        .
      </p>

      <form onSubmit={verify} className="mt-6">
        <label className="block">
          <span className="t-eyebrow">Code</span>
          <input
            type="text"
            required
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            disabled={!ready || !factorId}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-2 h-14 w-full rounded-md border border-line bg-surface-0 px-4
                       text-center font-mono text-[1.6rem] tabular-nums tracking-[0.4em] text-ink
                       outline-none transition-colors duration-fast focus:border-brand-vivid
                       disabled:opacity-45"
          />
        </label>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !factorId || code.length !== 6}
          className="mt-6 h-12 w-full rounded-full bg-brand-fill font-label text-label font-semibold
                     uppercase tracking-[0.08em] text-brand-on shadow-brand transition-all
                     duration-fast hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Verifying…" : "Verify"}
        </button>
      </form>

      <p className="mt-6 text-center text-label-xs leading-relaxed text-ink-faint">
        Lost your authenticator? A locked-out admin can only be restored from the Supabase
        dashboard — there are no recovery codes.
      </p>
    </div>
  );
}
