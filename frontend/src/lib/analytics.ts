/**
 * Google Analytics 4 — the one place that knows the property, the consent key,
 * and how consent is expressed to gtag.
 *
 * Read `lib/track.ts` first. It describes the FIRST-PARTY counters, which are
 * anonymous by construction and are what the admin Analytics screen is built
 * on. This file is a second, independent measurement path, and the two do not
 * feed each other: the first-party beacons keep counting exactly as before,
 * whether or not GA is configured and whether or not the reader consents.
 *
 * ---------------------------------------------------------------------------
 * WHY THE MEASUREMENT ID IS A LITERAL AND NOT ONLY AN ENVIRONMENT VARIABLE
 *
 * This repo has already been bitten once by a public feature that was
 * env-gated, unset on Vercel, and therefore silently off in production for
 * weeks — see the header of `lib/env.ts`, which exists solely because of it.
 * An analytics tag that quietly collects nothing fails in precisely that
 * shape: every page still renders, nothing logs, and the only symptom is a
 * dashboard that stays at zero and gets explained away as "no traffic yet".
 *
 * A GA measurement ID is not a secret and cannot be one — it ships in the HTML
 * of every page on the site, which is how the tag works at all. So there is
 * nothing to protect by moving it out of the repo, and a real cost to doing
 * so. It is a constant here, and the environment can still override it:
 *
 *   NEXT_PUBLIC_GA_ID unset  → this property. The normal case.
 *   NEXT_PUBLIC_GA_ID=G-...  → that property instead, for a second property on
 *                              previews so test traffic stays out of the real
 *                              numbers.
 *   NEXT_PUBLIC_GA_ID=""     → GA off entirely. Nothing is injected, no request
 *                              is made to Google, and no cookie can be set.
 *
 * The empty-string case is a genuine off switch and not a misconfiguration,
 * which is why it is `??` below and not `||` — an explicitly empty value must
 * survive rather than fall back to the constant.
 */
const DEFAULT_MEASUREMENT_ID = "G-QFFGGC6QKM";

export const GA_MEASUREMENT_ID = (
  process.env.NEXT_PUBLIC_GA_ID ?? DEFAULT_MEASUREMENT_ID
).trim();

/** Whether the tag should be injected at all. */
export const GA_ENABLED = GA_MEASUREMENT_ID.length > 0;

/**
 * Where the reader's answer lives.
 *
 * ⚠ This exact string is also the key `components/account/AccountSettings.tsx`
 * has written since before GA existed, and readers already have values stored
 * under it. Renaming it would silently reset every stored answer to the
 * default — which is "denied" — so it stays as it is.
 *
 * `localStorage` rather than a cookie, deliberately: a cookie would be sent on
 * every request to our own origin, which means the record of "I declined
 * analytics cookies" would itself be a cookie travelling to a server. It is
 * read synchronously by the bootstrap script below, before gtag loads, so
 * there is no window in which a consenting reader is measured as denied.
 */
export const ANALYTICS_CONSENT_KEY = "pickd-analytics-consent";

/** Dispatched on `window` when the reader changes their answer in this tab. */
export const ANALYTICS_CONSENT_EVENT = "pickd:analytics-consent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * The reader's stored answer, in THREE states rather than two.
 *
 * `null` — never asked. This is the state the banner exists to resolve, and it
 * is why `readAnalyticsConsent()` below cannot be the only reader: it folds
 * "declined" and "never asked" into the same `false`, so a banner built on it
 * would reappear on every page for everyone who had already said no. That is
 * the single most complained-about behaviour a consent banner can have.
 *
 * Unreadable storage also answers `null`, not `"denied"`. A reader in a private
 * window gets asked again next visit, which is the honest outcome — we genuinely
 * do not know what they chose, and guessing "denied" would be a decision made
 * on their behalf that we then never revisit.
 */
export type AnalyticsChoice = "granted" | "denied" | null;

export function readAnalyticsChoice(): AnalyticsChoice {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (raw === "1") return "granted";
    if (raw === "0") return "denied";
    return null;
  } catch {
    return null;
  }
}

/** The reader's stored answer. Absent, unreadable, or anything but "1" is a no. */
export function readAnalyticsConsent(): boolean {
  return readAnalyticsChoice() === "granted";
}

/**
 * Record the reader's answer and announce it.
 *
 * ⚠ This does NOT call gtag itself, and that is deliberate rather than an
 * omission. `GaRouteViews` listens for the event below and is the single place
 * that talks to the tag — because granting consent has to do two things in a
 * fixed order (update Consent Mode, then re-send the page view that was
 * measured while denied), and only that component knows what the current page
 * view was. Calling gtag here as well produced two identical `consent: update`
 * pushes for every answer, which is harmless but is the kind of duplication
 * that stops being harmless the moment someone adds a side effect to it.
 *
 * So: this module owns the ANSWER, that component owns the TAG. If GA is
 * switched off entirely there is no listener, and this correctly does nothing
 * beyond remembering what the reader said.
 */
export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, granted ? "1" : "0");
  } catch {
    /* Storage refused — a private window, or storage disabled. The consent
       still applies to THIS page via the event below; it just will not be
       remembered for the next one, and the reader will be asked again. */
  }
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT));
}

/**
 * Push the current answer into Consent Mode.
 *
 * Only `analytics_storage` moves. The three advertising signals are denied in
 * the bootstrap and are never granted from anywhere, because the cookie policy
 * and the settings screen both promise this is never shared with advertisers —
 * and a promise that depends on nobody adding a line later is not a promise.
 */
export function applyAnalyticsConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  window.gtag?.("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
  });
}

/**
 * A GA event, if GA is loaded. Silent otherwise — same reasoning as the
 * first-party beacon: analytics is the least important thing on any page it
 * runs on, and an ad blocker is not an error the reader should hear about.
 */
export function gaEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.gtag?.("event", name, params);
  } catch {
    /* never the reader's problem */
  }
}
