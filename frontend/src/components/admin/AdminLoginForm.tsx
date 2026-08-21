"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { createClient } from "@/lib/supabase/client";
import { safeInternalPath } from "@/lib/safe-path";

/**
 * Admin sign-in: password, then TOTP.
 *
 * Security notes that shape this component:
 *
 *  - **Uniform errors.** Wrong password and unknown email produce the same
 *    message, so this form cannot be used to discover which addresses are
 *    admins.
 *  - **Non-admins are refused at the door.** A shopper who enters valid
 *    credentials here is signed straight back out and shown the same message
 *    a wrong password gets. This form used to authenticate them and leave them
 *    holding a session — harmless as to privilege, since the real gates are
 *    FastAPI verifying `app_metadata.role` on every request plus RLS at the
 *    database, but a staff door should not open for a shopper at all.
 *  - **`next` is path-only.** Anything with a scheme or host is discarded, so
 *    this cannot be turned into an open redirect pointing at an attacker's site.
 */
type Step = "credentials" | "mfa";

export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Only same-origin paths survive. */
  function safeNext(): string {
    return safeInternalPath(params.get("next"), "/admin");
  }

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data: signIn, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Deliberately generic — never distinguish "no such user" from
      // "wrong password".
      setError("Those credentials were not accepted.");
      setBusy(false);
      return;
    }

    // ---- This is a staff door -------------------------------------------
    // A shopper's password is a perfectly valid password; it is just not a
    // credential for *this* door. Without this branch the admin form happily
    // authenticated them, minted a real session, and left them signed in as a
    // shopper on the public homepage — the proxy bounced them off /admin, so
    // nothing privileged leaked, but the staff login had still logged them in.
    //
    // Discard the session this form just created. `scope: "local"` so we only
    // undo what happened in this browser rather than signing them out of their
    // other devices over a wrong-door mistake.
    //
    // The message is the same one a wrong password gets. Saying "this is not
    // an admin account" would turn the staff door into an oracle for which
    // addresses hold the role — the exact leak the uniform errors above exist
    // to prevent.
    //
    // Cosmetic, in the sense that it protects nothing on its own: the proxy,
    // `get_current_admin` in FastAPI, and RLS each re-check the role against
    // signed claims. This is about the door not opening for the wrong person.
    const role = (signIn.user?.app_metadata as Record<string, unknown> | undefined)?.role;
    if (role !== "admin") {
      await supabase.auth.signOut({ scope: "local" });
      setError("Those credentials were not accepted.");
      setPassword("");
      setBusy(false);
      return;
    }

    // Does this account have a verified TOTP factor to satisfy?
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find((f) => f.status === "verified");

    if (totp) {
      setFactorId(totp.id);
      setStep("mfa");
      setBusy(false);
      return;
    }

    // No factor enrolled yet. The API refuses admin routes without aal2, so
    // send them straight to enrolment rather than a dashboard that 403s —
    // carrying `next`, so enrolment can finish the journey they started
    // instead of stranding them on the dashboard.
    const dest = safeNext();
    router.replace(`/admin/security?next=${encodeURIComponent(dest)}`);
    router.refresh();
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

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
      setError("That code was not accepted.");
      setCode("");
      setBusy(false);
      return;
    }

    router.replace(safeNext());
    router.refresh();
  }

  return (
    <div className="panel p-8">
      {step === "credentials" ? (
        <form onSubmit={submitCredentials} noValidate>
          <h1 className="font-display text-headline-md text-ink">Sign in</h1>
          <p className="mt-2 text-body-sm text-ink-muted">
            Staff accounts only. Access is granted manually.
          </p>

          <label className="mt-8 block">
            <span className="t-eyebrow">Email</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>

          <label className="mt-5 block">
            <span className="t-eyebrow">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
          </label>

          {error && <Alert>{error}</Alert>}

          <button type="submit" disabled={busy || !email || !password} className={submitCls}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitCode} noValidate>
          <h1 className="font-display text-headline-md text-ink">Two-factor code</h1>
          <p className="mt-2 text-body-sm text-ink-muted">
            Enter the 6-digit code from your authenticator app.
          </p>

          <label className="mt-8 block">
            <span className="t-eyebrow">Code</span>
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={cn(
                inputCls,
                "text-center font-mono text-[1.6rem] tracking-[0.4em] tabular-nums",
              )}
            />
          </label>

          {error && <Alert>{error}</Alert>}

          <button type="submit" disabled={busy || code.length !== 6} className={submitCls}>
            {busy ? "Verifying…" : "Verify"}
          </button>

          <button
            type="button"
            onClick={() => {
              setStep("credentials");
              setCode("");
              setError(null);
            }}
            className="mt-4 w-full font-label text-label-xs uppercase tracking-[0.1em] text-ink-subtle hover:text-brand"
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}

const inputCls =
  "mt-2 h-12 w-full rounded-md border border-line bg-surface-0 px-4 text-body-md text-ink " +
  "outline-none transition-colors duration-fast placeholder:text-ink-faint focus:border-brand-vivid";

const submitCls =
  "mt-8 inline-flex h-12 w-full items-center justify-center rounded-full bg-brand-fill " +
  "font-label text-label font-semibold uppercase tracking-[0.08em] text-brand-on shadow-brand " +
  "transition-all duration-fast ease-ease hover:brightness-110 " +
  "disabled:pointer-events-none disabled:opacity-45";

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-5 rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-body-sm text-danger-on-soft"
    >
      {children}
    </p>
  );
}
