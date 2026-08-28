import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient, getAdminGate, isConfigured } from "@/lib/supabase/server";
import { MfaChallenge } from "@/components/admin/MfaChallenge";
import { MfaEnrolment } from "@/components/admin/MfaEnrolment";
import { AdminPage, Contained } from "@/components/admin/Shell";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

// Reads the session and branches on it. A cached copy would be both wrong and
// a leak.
export const dynamic = "force-dynamic";

/**
 * Admin account security (spec §46).
 *
 * The one admin page reachable at aal1, because an admin who has not completed
 * a second factor has to be able to get *somewhere* — and this is where the
 * proxy sends them. Every other admin route, and every admin API route, still
 * refuses them until aal2.
 *
 * **This page gates itself.** It used to call `getAuthedUser()` and nothing
 * else — signed in was the whole test, no role check — relying entirely on the
 * proxy to keep shoppers out. That is precisely the mistake the proxy's own
 * header warns about: route protection is not authorization. If the matcher
 * ever stops covering this path, the page must still refuse on its own.
 *
 * Three states, three different screens:
 *
 *   aal2 admin           -> confirmation and how their access works
 *   aal1, factor exists  -> a challenge (they have 2FA; they just haven't used
 *                           it on this session)
 *   aal1, no factor      -> enrolment
 *
 * The middle case is the one that used to be missing. It rendered the aal2
 * confirmation screen, telling a locked-out admin that everything was fine
 * while every other route turned them away.
 */
export default async function AdminSecurityPage() {
  const gate = await getAdminGate();

  // Anonymous or not an admin. 404 rather than 403: whether an admin surface
  // exists at this path is not public information.
  if (!gate.ok && gate.reason !== "mfa_required") notFound();

  const email = gate.email;
  const verified = gate.ok;

  // Does a verified factor exist? Decides challenge vs. enrolment.
  let enrolled = false;
  if (isConfigured()) {
    const supabase = await createClient();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    enrolled = (factors?.totp ?? []).some((f) => f.status === "verified");
  }

  const body = (
    <>
      {!verified && (
        <div className="mb-6 rounded-lg border border-warn bg-warn-soft px-5 py-4">
          <p className="text-body-sm font-medium text-warn-on-soft">
            {enrolled
              ? "This session has not completed two-factor authentication."
              : "Two-factor authentication is required before you can manage content."}
          </p>
          <p className="mt-1 text-body-sm text-warn-on-soft">
            {enrolled
              ? "Enter a code below to finish signing in. Until then, every admin route will refuse this session."
              : "Admin API routes reject requests that have not completed a second factor."}
          </p>
        </div>
      )}

      {/* aal1 with a factor gets a challenge; aal1 without one gets enrolment;
          aal2 gets the confirmation panel that MfaEnrolment renders when it is
          told the factor is already in place. */}
      {/* Both read `next` from the query string, so both need a Suspense
          boundary around useSearchParams. */}
      <Suspense fallback={null}>
        {!verified && enrolled ? (
          <MfaChallenge email={email} />
        ) : (
          <MfaEnrolment alreadyEnrolled={verified && enrolled} />
        )}
      </Suspense>

      <section className="panel mt-6 p-8">
        <h2 className="text-headline-sm text-ink">How your access works</h2>
        <ul className="mt-4 space-y-3 text-body-sm text-ink-muted">
          <li>
            Your admin role lives in <code className="font-mono text-ink">app_metadata</code>,
            which only a database administrator can change. It cannot be granted through
            any page or API on this site.
          </li>
          <li>
            Every request is re-checked against your signed token — by the API, and again
            by the database, which now requires a completed second factor before it will
            treat you as an admin at all.
          </li>
          <li>
            Tampering with a response changes what your browser draws, and nothing else.
          </li>
          <li>Every change you make is written to the audit log, which cannot be edited or deleted.</li>
        </ul>
      </section>
    </>
  );

  // An unverified session never reaches the admin layout's chrome — the gate
  // in layout.tsx renders these children bare, with no sidebar and no padded
  // <main>. So this state supplies its own frame, the way the sign-in screen
  // does. It is a checkpoint, not an admin screen.
  if (!verified) {
    return (
      <div className="mx-auto w-full max-w-content px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8">
          <h1 className="font-display text-display-lg text-ink">Security</h1>
          <p className="t-eyebrow mt-2">{email}</p>
        </header>
        {body}
      </div>
    );
  }

  // Past the gate this is an ordinary admin screen, so it wears the ordinary
  // admin frame — it used to roll its own at `--shell-content`, which put its
  // heading 820px inboard of every other page in the panel.
  return (
    <AdminPage title="Security" eyebrow="System" description={email ?? undefined} refreshable={false}>
      <Contained>{body}</Contained>
    </AdminPage>
  );
}
