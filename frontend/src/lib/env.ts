/**
 * Build-time configuration, decided in exactly one place.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *
 * The production site once served the entire catalogue from `lib/mock/data.ts`
 * — fake products, fake prices, stock photography — while the real API sat
 * there fully populated. Nothing was broken. Nothing logged an error. The
 * mock fixtures use the SAME SLUGS as the real rows, so `/p/mobiles/samsung-
 * galaxy-s24` resolved, rendered, and looked correct. The only visible symptom
 * was that images uploaded through the admin CMS never appeared.
 *
 * The cause was one operator:
 *
 *     const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== "0";
 *
 * Mocks were the DEFAULT. An unset variable meant fixtures, and Vercel had it
 * unset. A deploy that forgets a variable should degrade loudly, not serve
 * fabricated content to real users with a straight face.
 *
 * So the polarity is inverted here, permanently:
 *
 *     Mocks are OPT-IN. Absent, empty, misspelled, "false", "no", "0" — all
 *     mean REAL API. Only an explicit "1" or "true" turns fixtures on.
 *
 * ---------------------------------------------------------------------------
 * THE THREE GUARANTEES
 *
 *   1. Mocks never render unless explicitly requested. (The polarity above.)
 *   2. Mocks CANNOT be requested in a production build. Asking for them fails
 *      the build rather than shipping them. (The assertion below.)
 *   3. Mock fixtures are not merely unused when off — they are absent from the
 *      compiled bundle entirely. `lib/api.ts` reaches them through `await
 *      import()` inside `if (USE_MOCKS)`, which the bundler drops whole once
 *      the condition folds to `false`. `scripts/assert-no-mocks.mjs` verifies
 *      this against the real build output on every `npm run build`, because a
 *      guarantee nothing checks is a comment.
 */

/**
 * Whether to render from `lib/mock/data.ts` instead of calling the API.
 *
 * Written as two literal comparisons against `process.env.<LITERAL>` rather
 * than something tidier like `["1","true"].includes(raw?.toLowerCase())`,
 * because the bundler's constant folding is what makes guarantee 3 real. Next
 * substitutes the string literal at build time, `"0" === "1"` folds to
 * `false`, and every `if (USE_MOCKS)` branch — including the dynamic import
 * inside it — is eliminated before it reaches a chunk. A `.toLowerCase()` in
 * the middle of that expression is opaque to the folder, and 41 KB of fake
 * products would ship to every browser as the price of the convenience.
 */
export const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS === "1" ||
  process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/**
 * Base URL of the FastAPI backend, including the `/api/v1` prefix.
 *
 * Empty rather than defaulting to `http://localhost:8000/api/v1`. That default
 * was the second half of the same failure: with mocks off and the variable
 * missing, every server-rendered request went to a loopback address that
 * cannot exist on Vercel, and the pages fell back to their empty states. A
 * misconfigured deploy is not a slow deploy — it should not start.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Configuration errors surface at module load, on the server, which during
 * `next build` means the deploy fails instead of shipping.
 *
 * Server-only for a reason: `lib/api.ts` is reachable from client components
 * (ContactForm, Newsletter), and throwing in the browser would blank a page at
 * hydration. It cannot get that far anyway — the build evaluates this module
 * while prerendering, so a bad configuration is rejected before a bundle is
 * ever handed to a browser.
 */
if (typeof window === "undefined") {
  if (USE_MOCKS && process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_USE_MOCKS is enabled in a production build. Fixture data " +
        "must never ship to real users — it once did, silently, for weeks. " +
        "Unset the variable (absent means real API) and set " +
        "NEXT_PUBLIC_API_URL to the deployed backend.",
    );
  }

  if (!USE_MOCKS && !API_URL) {
    throw new Error(
      "NEXT_PUBLIC_API_URL is not set and mocks are off, so there is no " +
        "source of data. Set NEXT_PUBLIC_API_URL to the backend origin " +
        "including its /api/v1 prefix, or set NEXT_PUBLIC_USE_MOCKS=1 for " +
        "local design work.",
    );
  }
}
