#!/usr/bin/env node
/**
 * Prove that no fixture data survived into the build.
 *
 * ---------------------------------------------------------------------------
 * WHY A SCRIPT AND NOT A COMMENT
 *
 * src/lib/env.ts promises three things, and the third one — "fixtures are
 * absent from the compiled bundle, not merely unused inside it" — is the only
 * one that cannot be verified by reading the source. It depends on the bundler
 * folding `USE_MOCKS` to a literal and eliminating the `await import()` in the
 * dead branch. That is reliable, but it is reliable *because of* a chain of
 * build-time behaviour: Next inlining NEXT_PUBLIC_* vars, SWC propagating a
 * module-level const across a module boundary, and webpack skipping
 * dependencies inside `if (false)`. Any of those can change under a version
 * bump, and nothing in the diff would look wrong when it does.
 *
 * The site already shipped fabricated products to production once without a
 * single error. The guarantee needs a test, so this runs on every build.
 *
 * ---------------------------------------------------------------------------
 * HOW IT DECIDES
 *
 * Markers are extracted FROM src/lib/mock/data.ts rather than hardcoded here,
 * so editing the fixtures cannot quietly empty this check. It uses the Unsplash
 * photo seeds: they are pure ASCII (so no minifier escaping can hide them),
 * they are unique to the fixtures, and real product imagery is a signed
 * Supabase URL that can never contain one.
 *
 * Any marker that also appears in non-fixture source is discarded — a shared
 * string is not evidence of anything. Hero.tsx carries its own stock photo,
 * which is exactly the false positive this removes.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const FIXTURES = join(ROOT, "src/lib/mock/data.ts");
const BUILD_DIR = join(ROOT, ".next");
const SRC_DIR = join(ROOT, "src");

/**
 * Next reads .env files itself; a plain node script does not, so a local
 * `npm run build` would see NEXT_PUBLIC_USE_MOCKS as unset even with
 * .env.local setting it — and this check would fail a build that is correctly
 * full of fixtures. Precedence matches Next: a real environment variable wins,
 * then .env.local, then .env.
 */
function loadEnvFiles() {
  for (const name of [".env.local", ".env"]) {
    let text;
    try {
      text = readFileSync(join(ROOT, name), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const [, key, rawValue] = m;
      if (key in process.env) continue;
      process.env[key] = rawValue.trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

loadEnvFiles();

// Same rule as src/lib/env.ts. Mocks are opt-in.
const USE_MOCKS =
  process.env.NEXT_PUBLIC_USE_MOCKS === "1" ||
  process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const done = (msg) => {
  console.log(`assert-no-mocks: ${msg}`);
  process.exit(0);
};

const fail = (msg) => {
  console.error(`\nassert-no-mocks: FAILED\n\n${msg}\n`);
  process.exit(1);
};

if (USE_MOCKS) {
  done("skipped — NEXT_PUBLIC_USE_MOCKS is on, fixtures belong in this build");
}

/** Every file under `dir` matching `test`, ignoring the build cache. */
function walk(dir, test, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    // `cache` is incremental build state, `dev` is the dev server's own output
    // (which keeps fixtures around from `next dev` runs and is never deployed).
    // Neither is the production artifact this check is about.
    if (entry === "cache" || entry === "dev" || entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, test, acc);
    else if (test(entry)) acc.push(full);
  }
  return acc;
}

/* --- 1. Derive the markers ------------------------------------------------ */

let fixtureSource;
try {
  fixtureSource = readFileSync(FIXTURES, "utf8");
} catch {
  done(`skipped — no fixtures at ${relative(ROOT, FIXTURES)}, nothing to leak`);
}

const candidates = [...new Set(fixtureSource.match(/photo-\d{10,}-[0-9a-f]{6,}/g) ?? [])];

if (candidates.length === 0) {
  fail(
    `No markers could be derived from ${relative(ROOT, FIXTURES)}.\n` +
      `This check has silently stopped checking anything. Either the fixtures\n` +
      `no longer use Unsplash photo seeds — in which case pick a new marker\n` +
      `above — or this script is pointed at the wrong file.`,
  );
}

// A string that also lives in real source is not evidence of a fixture leak.
const otherSource = walk(SRC_DIR, (f) => /\.(ts|tsx)$/.test(f))
  .filter((f) => !f.includes(join("lib", "mock")))
  .map((f) => readFileSync(f, "utf8"))
  .join("\n");

const markers = candidates.filter((m) => !otherSource.includes(m));

if (markers.length === 0) {
  fail(
    `Every fixture marker also appears outside src/lib/mock, so none of them\n` +
      `can distinguish fixture data from real content. Pick a marker that is\n` +
      `unique to the fixtures.`,
  );
}

/* --- 2. Search the build output ------------------------------------------- */

const bundles = walk(BUILD_DIR, (f) => /\.(js|mjs|cjs|json|html)$/.test(f));

if (bundles.length === 0) {
  fail(
    `No build output found under ${relative(ROOT, BUILD_DIR)}.\n` +
      `Run this after \`next build\`, not instead of it.`,
  );
}

const hits = [];
for (const file of bundles) {
  let contents;
  try {
    contents = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  const found = markers.filter((m) => contents.includes(m));
  if (found.length) hits.push({ file: relative(ROOT, file), found });
}

if (hits.length) {
  const detail = hits
    .slice(0, 20)
    .map((h) => `  ${h.file}\n    ${h.found.slice(0, 3).join(", ")}`)
    .join("\n");
  fail(
    `Mock fixture data reached the build with NEXT_PUBLIC_USE_MOCKS off.\n\n` +
      `${hits.length} file(s) contain fixture markers:\n\n${detail}\n\n` +
      `This is the failure that once served a fabricated catalogue to\n` +
      `production. Something now references src/lib/mock/data.ts outside an\n` +
      `\`if (USE_MOCKS)\` branch, or a static import replaced an \`await\n` +
      `import()\` in src/lib/api.ts and defeated dead-code elimination.`,
  );
}

done(
  `clean — ${markers.length} fixture marker(s) checked against ` +
    `${bundles.length} build files, none present`,
);
