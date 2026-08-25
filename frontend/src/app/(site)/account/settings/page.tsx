import type { Metadata } from "next";
import Link from "next/link";

import { getAuthedUser } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { AccountSettings } from "@/components/account/AccountSettings";
import {
  isOAuthOnly,
  resolveDisplayName,
  resolveSignInMethods,
} from "@/lib/display-name";

export const metadata: Metadata = { title: "Settings", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Account settings.
 *
 * Our privacy policy and terms both point people here to exercise their data
 * rights, so this page has to actually do it — a settings screen that only
 * offers a theme toggle would make those documents false.
 *
 * Sign-in details are read-only where Supabase owns them: changing an email or
 * password goes through a verified flow rather than a text field, and pretending
 * otherwise here would just fail confusingly.
 */
export default async function AccountSettingsPage() {
  const user = await getAuthedUser();

  // All three of these were read straight off `user_metadata.display_name` and
  // `app_metadata.provider`, which is right for a password account and wrong
  // for a Google one — see lib/display-name.ts.
  const displayName = resolveDisplayName(user);
  const methods = resolveSignInMethods(user);
  // `providers` is a list, not a single value: linking Google onto an existing
  // password account leaves both live, and this page is the one place that has
  // to say so.
  const provider = methods.length > 0 ? methods.join(", ") : "Email and password";
  const passwordless = isOAuthOnly(user);

  return (
    <div>
      <header className="mb-10">
        <h1 className="font-display text-display-lg text-ink">Settings.</h1>
        <p className="mt-3 max-w-xl text-body-lg text-ink-muted">
          Your sign-in details, what we hold, and how to get rid of it.
        </p>
      </header>

      {/* --- Identity ------------------------------------------------- */}
      <section aria-labelledby="identity">
        <h2 id="identity" className="t-eyebrow border-b border-line pb-4">
          Sign-in
        </h2>

        <dl className="mt-1">
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Display name" value={displayName || "Not set"} />
          <Row label="Sign-in method" value={provider} />
          <Row
            label="Member since"
            value={user?.created_at ? formatDate(user.created_at) : "—"}
          />
        </dl>

        {/* An account that only ever signed in with Google has no password,
            so "reset your password" is an instruction it cannot follow. Offer
            the thing that is actually true for it instead: the password lives
            at Google, and so does the way to change it. */}
        {passwordless ? (
          <p className="mt-5 max-w-prose text-body-sm text-ink-muted">
            You sign in with Google, so there is no SortedChoice password to change — your
            Google account controls access, and you change it there. Signing in with the same
            address and a password would attach that password to this same account rather than
            creating a second one.
          </p>
        ) : (
          <>
            <p className="mt-5 max-w-prose text-body-sm text-ink-muted">
              To change your email address or password we send a verification link to your inbox —
              neither can be changed from this page, because a hijacked session should not be able to
              lock you out of your own account.
            </p>

            <Link
              href="/forgot-password"
              className="mt-4 inline-flex items-center gap-2 font-label text-label font-semibold
                         uppercase tracking-[0.08em] text-brand transition-colors duration-fast hover:text-ink"
            >
              Send me a password reset link
              <span aria-hidden="true">→</span>
            </Link>
          </>
        )}
      </section>

      {/* --- Interactive: theme, consent, export, delete --------------- */}
      <AccountSettings />

      {/* --- Where the rules live ------------------------------------- */}
      <section aria-labelledby="policies" className="mt-section">
        <h2 id="policies" className="t-eyebrow border-b border-line pb-4">
          The rules that apply to this account
        </h2>
        <ul className="mt-1">
          {[
            { href: "/privacy", label: "Privacy policy", note: "What we hold and why" },
            { href: "/cookies", label: "Cookie policy", note: "What we set in your browser" },
            { href: "/terms", label: "Terms of service", note: "The agreement between us" },
            {
              href: "/editorial-policy",
              label: "Editorial policy",
              note: "How your reviews are moderated",
            },
          ].map((p) => (
            <li key={p.href} className="border-b border-line-faint last:border-b-0">
              <Link
                href={p.href}
                className="group flex items-baseline justify-between gap-4 py-3.5
                           text-body-md text-ink transition-colors duration-fast hover:text-brand"
              >
                <span className="flex items-baseline gap-2">
                  {p.label}
                  <span
                    className="text-brand opacity-0 transition-all duration-fast ease-ease
                               group-hover:translate-x-1 group-hover:opacity-100"
                    aria-hidden="true"
                  >
                    →
                  </span>
                </span>
                <span className="shrink-0 text-body-sm text-ink-subtle">{p.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line-faint py-3.5 last:border-b-0">
      <dt className="text-body-sm text-ink-subtle">{label}</dt>
      <dd className="text-body-md text-ink">{value}</dd>
    </div>
  );
}
