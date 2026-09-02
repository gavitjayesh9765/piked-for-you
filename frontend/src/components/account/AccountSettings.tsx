"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PasswordForm } from "@/components/account/PasswordForm";
import { readAnalyticsConsent, setAnalyticsConsent } from "@/lib/analytics";

const THEME_KEY = "pickd-theme";

type Theme = "light" | "dark" | "system";

/**
 * The interactive half of the settings page.
 *
 * Scope note: the destructive action here is a *request*, not a button that
 * deletes. Removing a user requires a service-role call that the browser SDK
 * cannot make, so a self-serve "Delete account" control would either fail
 * silently or need a privileged endpoint that does not exist yet. Shipping a
 * button that does nothing is worse than shipping an honest route, so deletion
 * goes through a real channel that a person actions — and the page says so
 * plainly rather than implying a one-click erase.
 */
export function AccountSettings({ passwordless }: { passwordless: boolean }) {
  return (
    <>
      {/* A Google-only account has no SortedChoice password, so a "Change
          password" form is not a setting it can use. Worse than useless:
          `updateUser({ password })` succeeds, so submitting it would quietly
          ATTACH a password to an account whose Sign-in section, a few lines
          up the same page, has just told the reader there is none. The two
          halves disagreed because this one is a client component rendered
          with no props, and so had no way to know. The server page already
          resolves `isOAuthOnly` for the copy above; it passes the same
          answer down rather than the question being asked twice.

          Linking Google onto an existing password account leaves `email` in
          `providers`, so those accounts are not passwordless and do keep the
          form. Admin password rotation is untouched — it does not come
          through here. */}
      {passwordless ? null : <SecuritySetting />}
      <ThemeSetting />
      <AnalyticsSetting />
      <DataSetting />
    </>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Security sits first because it is the only section here with a consequence
 * beyond this browser. Theme and analytics are local preferences; this one
 * changes a credential.
 */
function SecuritySetting() {
  return (
    <Section id="security" title="Security">
      <p className="max-w-prose text-body-sm text-ink-muted">
        Your password is stored and checked by our authentication provider — it never passes
        through this site&apos;s servers, and nobody here can read it.
      </p>
      <div className="mt-6">
        <PasswordForm />
      </div>
    </Section>
  );
}

function ThemeSetting() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme((localStorage.getItem(THEME_KEY) as Theme) ?? "system");
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === "system") {
      localStorage.removeItem(THEME_KEY);
      root.removeAttribute("data-theme");
    } else {
      localStorage.setItem(THEME_KEY, next);
      root.setAttribute("data-theme", next);
    }
  }

  return (
    <Section id="appearance" title="Appearance">
      <p className="max-w-prose text-body-sm text-ink-muted">
        Both themes are tuned separately rather than one being computed from the other. System
        follows your device.
      </p>

      <div
        className="mt-5 inline-flex rounded-full border border-line p-1"
        role="radiogroup"
        aria-label="Theme"
      >
        {(["light", "dark", "system"] as const).map((option) => {
          // Until mounted, SSR and client must agree, so nothing reads selected.
          const active = mounted && theme === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => apply(option)}
              className={`rounded-full px-5 py-2 font-label text-label-xs font-semibold uppercase
                          tracking-[0.08em] transition-colors duration-fast ${
                            active
                              ? "bg-brand-fill text-brand-on-fill"
                              : "text-ink-muted hover:text-ink"
                          }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

/**
 * ⚠ This toggle is no longer decorative.
 *
 * It used to write a key nothing read: the site's own counters are anonymous
 * and cookieless, so there was never anything for a reader to consent to. That
 * changed when Google Analytics was added — this switch is now the ONLY thing
 * standing between a reader and a `_ga` cookie, and it is what makes the
 * promise on /cookies ("set only if you agree") literally true.
 *
 * Which is why it goes through `setAnalyticsConsent` rather than touching
 * localStorage directly. That helper writes the answer AND pushes it into
 * Consent Mode in the same call, so consent withdrawn here stops applying on
 * this page immediately rather than at the next reload. Writing the key by
 * hand would leave the reader looking at an "off" switch on a page still being
 * measured. See lib/analytics.ts.
 */
function AnalyticsSetting() {
  const [on, setOn] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setOn(readAnalyticsConsent());
  }, []);

  function toggle() {
    const next = !on;
    setOn(next);
    setAnalyticsConsent(next);
  }

  return (
    <Section id="privacy" title="Privacy">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-prose">
          <p className="text-body-md text-ink">Aggregate analytics</p>
          <p className="mt-2 text-body-sm text-ink-muted">
            Lets us see which pages are read and which are not, using Google Analytics. With this
            off it stays cookieless and cannot recognise you between visits; on, it sets a cookie
            so returning readers are counted as returning. Never used to build a profile of you,
            never shared with advertisers, and the site works identically either way.{" "}
            <Link
              href="/cookies"
              className="text-brand underline decoration-brand-line underline-offset-4
                         transition-colors duration-fast hover:decoration-brand"
            >
              What this sets
            </Link>
            .
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={mounted ? on : false}
          aria-label="Aggregate analytics"
          onClick={toggle}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-fast ${
            mounted && on ? "border-brand-line bg-brand-fill" : "border-line bg-surface-2"
          }`}
        >
          <span
            className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-surface-0
                        shadow-e1 transition-transform duration-fast ease-ease ${
                          mounted && on ? "translate-x-[1.4rem]" : "translate-x-[0.15rem]"
                        }`}
          />
        </button>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

function DataSetting() {
  return (
    <Section id="your-data" title="Your data">
      <p className="max-w-prose text-body-sm text-ink-muted">
        You can ask us for a copy of everything we hold about you, or ask us to delete it along
        with your account. We respond within 30 days, and we will not make the site worse for you
        because you asked.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card
          title="Request your data"
          body="A machine-readable copy of your account, saved products, preferences, and reviews."
          href="/contact?topic=support&subject=data-export"
          cta="Request a copy"
        />
        <Card
          title="Delete your account"
          body="Removes your account and personal data within 30 days. Published reviews are anonymised unless you ask for them to be removed outright."
          body2="Handled by a person rather than a single click, so it cannot be triggered by someone who has got hold of your session."
          href="/contact?topic=support&subject=account-deletion"
          cta="Request deletion"
          danger
        />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="mt-section">
      <h2 id={id} className="t-eyebrow border-b border-line pb-4">
        {title}
      </h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Card({
  title,
  body,
  body2,
  href,
  cta,
  danger,
}: {
  title: string;
  body: string;
  body2?: string;
  href: string;
  cta: string;
  danger?: boolean;
}) {
  return (
    <div className={`panel flex flex-col p-5 ${danger ? "border-danger-soft" : ""}`}>
      <h3 className="text-headline-sm text-ink">{title}</h3>
      <p className="mt-2 text-body-sm text-ink-muted">{body}</p>
      {body2 ? <p className="mt-2 text-body-sm text-ink-subtle">{body2}</p> : null}
      <Link
        href={href}
        className={`mt-auto inline-flex items-center gap-2 pt-5 font-label text-label
                    font-semibold uppercase tracking-[0.08em] transition-colors duration-fast ${
                      danger ? "text-danger hover:text-ink" : "text-brand hover:text-ink"
                    }`}
      >
        {cta}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
