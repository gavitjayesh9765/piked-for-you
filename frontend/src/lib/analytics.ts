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

/** The reader's stored answer. Absent, unreadable, or anything but "1" is a no. */
export function readAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ANALYTICS_CONSENT_KEY) === "1";
  } catch {
    // Private mode, disabled storage, a quota error. Unknown is not consent.
    return false;
  }
}

/**
 * Record the reader's answer and tell gtag about it in the same breath.
 *
 * These two must not drift. A settings toggle that writes storage but leaves
 * the live page measuring is a consent control that does not control anything
 * until the next reload, and the reader has no way to know that.
 */
export function setAnalyticsConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_KEY, granted ? "1" : "0");
  } catch {
    /* Storage refused. The consent update below still applies to this page. */
  }
  applyAnalyticsConsent(granted);
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
