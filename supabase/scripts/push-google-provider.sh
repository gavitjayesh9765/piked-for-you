#!/usr/bin/env bash
#
# Configure Google sign-in on the HOSTED Supabase project.
#
# Same seam, same reason as push-email-templates.sh: config.toml drives the
# local stack only, the hosted project's auth config is separate state behind
# the Management API, and the MCP server exposes no tool for it. Clicking it
# into the dashboard works exactly once and then nobody can say what the live
# settings are without going to look.
#
#   export SUPABASE_ACCESS_TOKEN=sbp_...        # dashboard → account → tokens
#   export SUPABASE_AUTH_GOOGLE_CLIENT_ID=...   # Google Cloud → Credentials
#   export SUPABASE_AUTH_GOOGLE_SECRET=...
#   bash supabase/scripts/push-google-provider.sh --dry-run
#   bash supabase/scripts/push-google-provider.sh
#
# Flags
#   --dry-run   report what would be sent, send nothing
#   --disable   turn Google sign-in OFF (credentials not required)
#
# What this does NOT do: create the Google Cloud OAuth client. That is a
# console UI with a consent screen to fill in and no API worth driving — see
# docs/09-google-sign-in.md. Bring the client ID and secret here afterwards.
#
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-qokjrsciihybnznbgqjn}"
# Exported, not just set: the payload below is built by `node -e`, which reads
# these out of the environment. A plain shell assignment is invisible to it.
export SITE_URL="${SUPABASE_SITE_URL:-https://sortedchoice.com}"
API="https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth"

dry_run=0
disable=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --disable) disable=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

command -v node >/dev/null || { echo "node is required to build the payload" >&2; exit 1; }
command -v curl >/dev/null || { echo "curl is required" >&2; exit 1; }

# --- The redirect allow-list ------------------------------------------------
#
# The half of this that is easy to forget. Supabase validates the `redirectTo`
# the browser sends against this list and, when it fails, silently falls back
# to the site URL. That does not look like an error: sign-in succeeds and the
# shopper simply lands on the homepage instead of the page they were reading,
# every time, with nothing logged on our side. Both callback URLs go in here.
#
# Vercel preview deployments get a wildcard entry so a branch preview can be
# signed into. It is scoped to our own project's preview domain — a bare
# `https://**` here would let any site on the internet receive a session.
read -r -d '' ALLOW_LIST <<'EOF' || true
https://sortedchoice.com/auth/callback,
https://www.sortedchoice.com/auth/callback,
https://sortedchoice.vercel.app/auth/callback,
https://sortedchoice-*.vercel.app/auth/callback,
http://localhost:3000/auth/callback
EOF
export ALLOW_LIST="$(echo "$ALLOW_LIST" | tr -d '\n ')"

if [ "$disable" -eq 1 ]; then
  payload="$(node -e 'process.stdout.write(JSON.stringify({ external_google_enabled: false }))')"
  summary="DISABLE Google sign-in"
else
  : "${SUPABASE_AUTH_GOOGLE_CLIENT_ID:?SUPABASE_AUTH_GOOGLE_CLIENT_ID is not set — Google Cloud Console → APIs & Services → Credentials}"
  : "${SUPABASE_AUTH_GOOGLE_SECRET:?SUPABASE_AUTH_GOOGLE_SECRET is not set}"

  # A Google web client id always ends in .apps.googleusercontent.com. Catching
  # a truncated paste here costs nothing; catching it in production means a
  # sign-in button that fails for everyone with an error only Google can see.
  case "$SUPABASE_AUTH_GOOGLE_CLIENT_ID" in
    *.apps.googleusercontent.com) ;;
    *) echo "client id does not look like a Google web client (expected …apps.googleusercontent.com)" >&2; exit 1 ;;
  esac

  # Built by node rather than by string-concatenating JSON: the secret is
  # opaque and must survive whatever characters it contains.
  payload="$(node -e '
    process.stdout.write(JSON.stringify({
      external_google_enabled: true,
      external_google_client_id: process.env.SUPABASE_AUTH_GOOGLE_CLIENT_ID,
      external_google_secret: process.env.SUPABASE_AUTH_GOOGLE_SECRET,
      // Nonce checking stays on. Skipping it is for native ID-token flows;
      // ours is the browser redirect, where the nonce is a replay defence.
      external_google_skip_nonce_check: false,
      site_url: process.env.SITE_URL,
      uri_allow_list: process.env.ALLOW_LIST,

      // Not about Google, but about the door beside it, and this is the one
      // script that owns hosted auth config.
      //
      // The database linter flags `auth_leaked_password_protection`: without
      // it the password form accepts a password that is already in a public
      // breach corpus, which is how accounts are actually taken over -- not by
      // guessing, but by reuse. The check is k-anonymous, so a 5-character
      // hash prefix leaves the server and the password never does. There is no
      // local equivalent (it is a hosted-only feature), which is exactly why
      // it has to be set from here.
      password_hibp_enabled: true,

      // The floor the signup form already claims -- `minLength={10}` is a
      // browser attribute, and the hosted default underneath it was 6. Mirrors
      // `minimum_password_length` in config.toml.
      password_min_length: 10,

      // Session lifetime. Without these a refresh token renews forever and no
      // session ever ends -- see the [auth.sessions] block in config.toml for
      // why there are two bounds rather than one. Seconds here; the CLI takes
      // durations. The admin console layers its own 30-minute idle sign-out on
      // top of these, because they are deliberately shopper-length.
      sessions_inactivity_timeout: 336 * 3600,  // 14 days unused
      sessions_timebox: 720 * 3600,             // 30 days absolute
    }));
  ')"
  summary="ENABLE Google sign-in with client ${SUPABASE_AUTH_GOOGLE_CLIENT_ID%%.*}…"
fi

if [ "$dry_run" -eq 1 ]; then
  echo "dry run — nothing sent to project $PROJECT_REF"
  echo "  $summary"
  echo "  site_url      $SITE_URL"
  echo "  uri_allow_list"
  echo "$ALLOW_LIST" | tr ',' '\n' | sed 's/^/    /'
  exit 0
fi

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is not set — create a personal access token at https://supabase.com/dashboard/account/tokens}"

response="$(curl -fsS -X PATCH "$API" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$payload")"

# Read the result back rather than trusting the 2xx. The API does not echo the
# secret, so the check is: is the provider on, is the client id the one we
# sent, and is our callback actually in the list it will validate against.
CLIENT_ID="${SUPABASE_AUTH_GOOGLE_CLIENT_ID:-}" node -e '
  let raw = "";
  process.stdin.on("data", (d) => (raw += d));
  process.stdin.on("end", () => {
    const got = JSON.parse(raw);
    const list = String(got.uri_allow_list || "").split(",").filter(Boolean);
    console.log(`  google enabled   ${got.external_google_enabled}`);
    console.log(`  client id        ${got.external_google_client_id || "(none)"}`);
    console.log(`  site url         ${got.site_url}`);
    console.log(`  hibp enabled     ${got.password_hibp_enabled}`);
    console.log(`  min password     ${got.password_min_length}`);
    console.log(`  session timebox  ${got.sessions_timebox}s`);
    console.log(`  session idle     ${got.sessions_inactivity_timeout}s`);
    console.log(`  redirect allow-list (${list.length})`);
    for (const u of list) console.log(`    ${u}`);

    const want = process.env.CLIENT_ID;
    const problems = [];
    if (want) {
      if (!got.external_google_enabled) problems.push("provider is not enabled");
      if (got.external_google_client_id !== want) problems.push("client id did not stick");
      if (!list.some((u) => u.includes("sortedchoice.com/auth/callback")))
        problems.push("production callback is missing from the allow-list");
      if (!got.password_hibp_enabled) problems.push("leaked-password protection did not stick");
    }
    if (problems.length) {
      console.error("\n" + problems.map((p) => `  ! ${p}`).join("\n"));
      process.exit(1);
    }
    console.log("\nok");
  });
' <<< "$response"
