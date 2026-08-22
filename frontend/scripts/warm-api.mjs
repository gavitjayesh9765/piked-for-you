#!/usr/bin/env node
/**
 * Wake the API before `next build` prerenders 36 pages against it.
 *
 * The backend is a Render Free instance (render.yaml: `plan: free`) in
 * Singapore; Vercel builds in Washington. Free instances spin down after 15
 * minutes idle and take roughly a minute to answer the first request. A deploy
 * that starts prerendering into a sleeping instance gets nothing back inside
 * the per-call build budget, so every page renders its fallback and the deploy
 * ships an empty-looking site until ISR repairs it 300s later.
 *
 * One request here, paid once, wakes it for all 36. When it is already awake
 * this costs a few hundred milliseconds.
 *
 * Deliberately never fails the build. A dead API is a degraded deploy, not a
 * broken one — src/lib/api.ts already bounds every call and the chrome paths
 * fall back. This script only removes the *avoidable* cause.
 *
 * Wired as `prebuild`, which npm runs automatically before `build`.
 */

const RAW = process.env.NEXT_PUBLIC_API_URL;
// Mocks are opt-in — same rule as src/lib/env.ts, restated because a plain
// node script cannot import the TypeScript module. Keep the two in step.
const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS === "1" ||
  process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** Long enough to sit through a Render Free cold start, then give up. */
const TIMEOUT_MS = 90_000;

const skip = (why) => {
  console.log(`warm-api: skipped (${why})`);
  process.exit(0);
};

if (USE_MOCKS) skip("NEXT_PUBLIC_USE_MOCKS is on, nothing to warm");
if (!RAW) skip("NEXT_PUBLIC_API_URL is not set");

let origin;
try {
  ({ origin } = new URL(RAW));
} catch {
  skip(`NEXT_PUBLIC_API_URL is not a valid URL: ${RAW}`);
}

// A local API is either already running or intentionally not; waiting on it
// would just add 90s to every `npm run build` on a laptop.
if (/^(localhost|127\.|\[?::1)/.test(new URL(RAW).hostname)) {
  skip(`${origin} is local`);
}

const started = Date.now();
const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;

try {
  const res = await fetch(`${origin}/health`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: "application/json" },
  });
  console.log(`warm-api: ${origin}/health → ${res.status} in ${elapsed()}`);
  if (!res.ok) {
    console.log("warm-api: non-2xx — the build will fall back where it must");
  }
} catch (err) {
  // Timeout, DNS failure, connection refused. All the same outcome here.
  console.log(`warm-api: ${origin} unreachable after ${elapsed()} (${err?.name ?? "error"})`);
  console.log("warm-api: continuing — pages that need the API will use their fallbacks");
}
