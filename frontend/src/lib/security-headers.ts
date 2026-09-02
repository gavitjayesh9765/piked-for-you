import { GA_ENABLED } from "@/lib/analytics";

/**
 * Google Analytics hosts, admitted ONLY when the tag is actually configured.
 *
 * `GA_ENABLED` is false when `NEXT_PUBLIC_GA_ID` is set to an empty string,
 * and in that case none of these appear in the policy at all — turning GA off
 * closes the holes it needed rather than leaving them open for nothing.
 *
 * ⚠ The `script-src` entry is dead weight in every modern browser and is here
 * on purpose. `'strict-dynamic'` makes a browser that understands it IGNORE
 * every host in `script-src`, and gtag.js is loaded by our nonce-carrying
 * bootstrap, so trust reaches it that way. This host is the fallback for
 * browsers old enough to skip strict-dynamic and fall back to the allowlist.
 * Removing it does not break anything you are likely to test on, which is
 * precisely why it needs a comment rather than a silent deletion.
 *
 * `connect-src` is NOT optional in the same way. gtag.js beacons to
 * `*.google-analytics.com` (and region-sharded `*.analytics.google.com`) by
 * fetch/sendBeacon, and those are blocked by `default-src 'self'` otherwise —
 * the tag would load, appear installed, and report nothing.
 *
 * No doubleclick.net anywhere, deliberately: the advertising consent signals
 * are denied at boot and never granted, so nothing here should ever be talking
 * to an ad host. If one shows up blocked in the console, that is the policy
 * doing its job and the question is what turned it on.
 */
const GA_SCRIPT_HOSTS = ["https://www.googletagmanager.com"];
const GA_CONNECT_HOSTS = [
  "https://www.googletagmanager.com",
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
];

/**
 * Security response headers.
 *
 * The CSP is the one that matters for the threat you raised. Payload
 * encryption cannot protect a browser app — the key would ship in the
 * JavaScript. What actually stops an attacker reading or rewriting page data is
 * preventing their script from running at all, which is what a strict,
 * nonce-based CSP does.
 *
 * `'unsafe-inline'` is absent from script-src in production. Only scripts
 * carrying the per-request nonce execute, so an injected `<script>` — from a
 * reflected parameter, a stored review, anywhere — is inert.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    // strict-dynamic lets nonce-trusted scripts load their own chunks, which
    // Next needs, without re-opening the door to arbitrary inline script.
    // Dev additionally needs unsafe-eval for hot reloading; production does not.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(GA_ENABLED ? GA_SCRIPT_HOSTS : []),
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],

    // Styles still need unsafe-inline: Tailwind and next/font emit inline
    // <style>, and React writes inline style attributes. This is a far smaller
    // risk than inline script — CSS cannot exfiltrate a session.
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],

    "img-src": ["'self'", "blob:", "data:", "https:"],  // includes i.ytimg.com posters
    "media-src": ["'self'", "blob:", "https:"],

    // Supabase (auth + storage + realtime) and our own API.
    "connect-src": [
      "'self'",
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/^https?:/, "wss:"),
      process.env.NEXT_PUBLIC_API_URL ?? "",
      ...(GA_ENABLED ? GA_CONNECT_HOSTS : []),
      ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
    ].filter(Boolean),

    // Nothing on this site may be framed BY anyone.
    "frame-ancestors": ["'none'"],
    // We frame only these two, and only for product video embeds. Listing the
    // exact hosts means an injected <iframe> pointing anywhere else is blocked.
    "frame-src": [
      "https://www.youtube-nocookie.com",
      "https://www.youtube.com",
      "https://player.vimeo.com",
    ],
    "object-src": ["'none'"],

    // Locks <base href> — otherwise an injection could reroute every relative
    // URL on the page, including script sources.
    "base-uri": ["'self'"],

    // Forms may only post back to us: an injected form cannot exfiltrate
    // whatever the user types into an attacker's endpoint.
    "form-action": ["'self'"],

    ...(isDev ? {} : { "upgrade-insecure-requests": [] }),
  };

  return Object.entries(directives)
    .map(([key, values]) => (values.length ? `${key} ${values.join(" ")}` : key))
    .join("; ");
}

/** Static headers, applied to every response. */
export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  // Never let a browser guess a content type — the classic way an uploaded
  // "image" gets executed as script.
  "X-Content-Type-Options": "nosniff",

  // Belt and braces alongside frame-ancestors, for older browsers.
  "X-Frame-Options": "DENY",

  // Do not leak the full URL (which can carry ids or tokens) to other origins.
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // We ask for none of these; deny them all rather than rely on prompts.
  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "interest-cohort=()",
  ].join(", "),

  // Isolates this origin from cross-origin window references.
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-DNS-Prefetch-Control": "on",
};

/** HSTS. Production only — sending it over plain HTTP in dev would pin
 *  localhost to HTTPS in your browser and be genuinely annoying to undo. */
export const HSTS_HEADER = "max-age=63072000; includeSubDomains; preload";
