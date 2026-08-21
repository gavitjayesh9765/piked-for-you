/**
 * Validate a `next` redirect target.
 *
 * Four copies of this check existed — the proxy, the login form, the MFA
 * challenge and the enrolment screen — and all four tested
 * `startsWith("/") && !startsWith("//")`. That rejects the obvious
 * `//evil.example`, and misses the rest:
 *
 *   /\evil.example     browsers normalise the backslash to a slash, so this
 *                      becomes a protocol-relative URL to another host
 *   /%09/evil.example  leading whitespace is stripped before the URL is parsed
 *   /\/evil.example    the same normalisation, one step further round
 *
 * Any of those turns a login redirect into an open redirect — the exact thing
 * the original check was written to prevent. Rather than enumerate the tricks,
 * this resolves the value against a throwaway origin and keeps it only if it
 * still points there. Whatever the URL parser thinks the string means is what
 * gets tested, which is what the browser will think too.
 */
const SENTINEL = "https://safe-path.invalid";

/** C0 controls and space — stripped by URL parsers before the scheme is read,
 *  so they can smuggle a leading `//` past a naive prefix test. */
const LEADING_JUNK = /[\u0000-\u0020]/;

export function safeInternalPath(raw: string | null | undefined, fallback = "/admin"): string {
  if (!raw) return fallback;
  if (LEADING_JUNK.test(raw)) return fallback;
  if (!raw.startsWith("/")) return fallback;

  let url: URL;
  try {
    url = new URL(raw, SENTINEL);
  } catch {
    return fallback;
  }

  // Resolved to a different origin: it was protocol-relative or absolute all
  // along, whatever it looked like as a string.
  if (url.origin !== SENTINEL) return fallback;

  // Keep the query — dropping it lands a returning admin on an unfiltered
  // first page rather than the view they had open. The fragment is never sent
  // to a server, so it is not worth carrying.
  const path = url.pathname + url.search;
  return path.startsWith("//") ? fallback : path;
}

/**
 * The same validation, plus: never an admin route.
 *
 * For the *public* login and the account area. A shopper signing in at
 * /login?next=/admin/products should land on the homepage, not be walked up to
 * a staff door — the proxy and the API would refuse them anyway, but sending
 * them there produces a confusing bounce and advertises that the surface
 * exists.
 *
 * This existed as a hand-rolled `startsWith("/") && !startsWith("//")` test in
 * PublicAuthForm, AccountLayout and the auth callback — the exact check the
 * header of this file explains is insufficient. `/\evil.example` passed all
 * three: browsers normalise the backslash to a slash, so `new URL()` resolved
 * it to a different origin and the "internal" redirect left the site.
 */
export function safePublicPath(raw: string | null | undefined, fallback = "/"): string {
  const path = safeInternalPath(raw, fallback);
  // Case-insensitive: routing is case-sensitive but the intent here is "does
  // this aim at the staff surface", and /Admin aims at it just as squarely.
  if (/^\/admin(\/|$|\?)/i.test(path)) return fallback;
  return path;
}
