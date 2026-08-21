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
