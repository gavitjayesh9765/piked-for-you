"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-path";

/**
 * TOTP enrolment for admins.
 *
 * Supabase generates and stores the secret; it never passes through our
 * backend and is never persisted by us. The QR is rendered from the
 * `totp.qr_code` SVG Supabase returns, so the secret does not travel to a
 * third-party chart service either.
 *
 * There are no recovery codes. There used to be a screen that generated eight
 * of them in the browser, displayed them, and threw them away — nothing was
 * ever sent anywhere, while the copy told the reader they were stored as
 * hashes. A backup code that does not exist is worse than no backup code,
 * because the reader stops looking for one. The backup path is a second
 * enrolled factor, which Supabase actually honours.
 */
type Stage = "idle" | "enrolling" | "verify" | "done";

export function MfaEnrolment({ alreadyEnrolled }: { alreadyEnrolled: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  /** Where the login flow was headed before enrolment interrupted it. */
  function safeNext(): string {
    return safeInternalPath(params.get("next"), "/admin");
  }

  const [stage, setStage] = useState<Stage>(alreadyEnrolled ? "done" : "idle");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!alreadyEnrolled && stage === "idle") void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function begin() {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Clear any half-finished factor from a previous attempt, or enrolment
    // fails with "a factor with this friendly name already exists".
    //
    // Read `.all`, not `.totp`: listFactors only files a factor under its type
    // bucket once it is *verified*, so `.totp` is exactly the set this loop
    // must not touch. Iterating it left every abandoned factor in place and
    // deadlocked enrolment permanently.
    const { data: existing } = await supabase.auth.mfa.listFactors();
    for (const f of existing?.all ?? []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    // Unique per attempt. Even with the cleanup above, a name derived from the
    // date alone means one unenroll failure blocks every retry for 24 hours.
    const { data, error: enrolError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `PickDForYou ${new Date().toISOString().replace(/[:.]/g, "-")}`,
    });

    if (enrolError || !data) {
      // Show what actually failed. The old blanket "reload and try again" hid
      // a permanent error behind advice that could never work.
      setError(enrolError?.message ?? "Could not start enrolment.");
      setBusy(false);
      return;
    }

    setFactorId(data.id);
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStage("verify");
    setBusy(false);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
    if (cErr || !challenge) {
      setError("Could not verify. Try again.");
      setBusy(false);
      return;
    }

    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    });

    if (vErr) {
      setError("That code was not accepted. Check your device clock is correct.");
      setCode("");
      setBusy(false);
      return;
    }

    // Verifying promotes this session to aal2, which is what every admin route
    // is actually waiting on. Refresh so the server re-reads the new claims.
    setStage("done");
    setBusy(false);
    router.refresh();
  }

  if (stage === "done") {
    return (
      <div className="panel p-8">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-value-soft text-value-on-soft">
            <CheckGlyph />
          </span>
          <div>
            <h2 className="text-headline-sm text-ink">Two-factor authentication is on</h2>
            <p className="mt-2 text-body-sm text-ink-muted">
              Your account requires a code at every sign-in. A stolen password alone cannot
              reach the admin panel. There are no recovery codes — if you may lose this
              device, enrol a second authenticator now, because a locked-out admin can only
              be restored from the Supabase dashboard.
            </p>
            {/* Enrolment is an interruption, not a destination. Offer the way
                back to wherever they were going. */}
            <Link
              href={safeNext()}
              className="mt-5 inline-flex h-10 items-center rounded-full bg-brand-fill px-6
                         font-label text-label-xs font-semibold uppercase tracking-[0.1em]
                         text-brand-on shadow-brand transition-all duration-fast
                         hover:brightness-110"
            >
              Continue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel p-8">
      <h2 className="text-headline-sm text-ink">Set up two-factor authentication</h2>
      <p className="mt-2 text-body-sm text-ink-muted">
        Scan this with Google Authenticator, Authy, or 1Password.
      </p>

      {qr && (
        <div className="mt-6 flex justify-center">
          {/* Supabase returns an SVG data URI; rendering it locally keeps the
              secret off any third-party service. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="Two-factor setup QR code"
            className="h-52 w-52 rounded-md border border-line bg-white p-2"
          />
        </div>
      )}

      {secret && (
        <details className="mt-5">
          <summary className="cursor-pointer font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand">
            Can't scan? Enter manually
          </summary>
          <code className="mt-3 block break-all rounded-md border border-line bg-surface-1 p-3 font-mono text-body-sm text-ink">
            {secret}
          </code>
        </details>
      )}

      <form onSubmit={verify} className="mt-6">
        <label className="block">
          <span className="t-eyebrow">Enter the 6-digit code</span>
          <input
            type="text"
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="mt-2 h-14 w-full rounded-md border border-line bg-surface-0 px-4
                       text-center font-mono text-[1.6rem] tabular-nums tracking-[0.4em] text-ink
                       outline-none transition-colors duration-fast focus:border-brand-vivid"
          />
        </label>

        {error && (
          <p role="alert" className="mt-4 rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.length !== 6}
          className="mt-6 h-12 w-full rounded-full bg-brand-fill font-label text-label font-semibold
                     uppercase tracking-[0.08em] text-brand-on shadow-brand transition-all
                     duration-fast hover:brightness-110 disabled:pointer-events-none disabled:opacity-45"
        >
          {busy ? "Verifying…" : "Turn on 2FA"}
        </button>
      </form>
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}
