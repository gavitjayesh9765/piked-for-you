#!/usr/bin/env bash
#
# Push every branded auth email to the HOSTED Supabase project.
#
# config.toml configures the local stack only. The hosted project's templates
# are separate state behind the Management API, and the MCP server exposes no
# tool for them — so this script is the seam that keeps local and remote
# showing the same email.
#
#   export SUPABASE_ACCESS_TOKEN=sbp_...   # dashboard → account → tokens
#   bash supabase/scripts/push-email-templates.sh --dry-run
#   bash supabase/scripts/push-email-templates.sh
#
# Flags
#   --dry-run                 build and report, send nothing
#   --enable-notifications    also switch ON the security-notification emails
#                             (password changed, sign-in method linked, …).
#                             Without it their templates are updated but their
#                             enabled flags are left exactly as they are, so a
#                             template push never starts sending new mail.
#
# The payload is generated in memory by build.mjs rather than read off disk:
# a forgotten rebuild cannot ship a stale email, and the API key names live in
# exactly one place.
#
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-qokjrsciihybnznbgqjn}"
API="https://api.supabase.com/v1/projects/$PROJECT_REF/config/auth"

dry_run=0
build_args=()
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --enable-notifications) build_args+=("--enable-notifications") ;;
    *) echo "unknown flag: $arg" >&2; exit 2 ;;
  esac
done

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
builder="$here/../templates/build.mjs"
[ -f "$builder" ] || { echo "missing builder: $builder" >&2; exit 1; }
command -v node >/dev/null || { echo "node is required to build the payload" >&2; exit 1; }

# build.mjs verifies before it emits, and exits non-zero on any problem, so a
# template that references a variable it will never receive stops the deploy
# here rather than landing in someone's inbox as literal {{ .Whatever }}.
payload="$(node "$builder" --payload "${build_args[@]+"${build_args[@]}"}")"

if [ "$dry_run" -eq 1 ]; then
  echo "dry run — nothing sent to project $PROJECT_REF"
  exit 0
fi

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is not set — create a personal access token at https://supabase.com/dashboard/account/tokens}"

# One PATCH for all templates: a partial push would leave the project sending a
# mix of old and new branding.
response="$(curl -fsS -X PATCH "$API" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "$payload")"

# Read the result back rather than trusting the 2xx: confirm the confirmation
# template the API now holds is the one we just sent.
node -e '
  let raw = "";
  process.stdin.on("data", (d) => (raw += d));
  process.stdin.on("end", () => {
    const got = JSON.parse(raw);
    const rows = Object.keys(got)
      .filter((k) => k.startsWith("mailer_templates_") && got[k])
      .map((k) => [k.replace(/^mailer_templates_|_content$/g, ""), String(got[k]).length]);
    for (const [name, len] of rows.sort()) {
      console.log(`  ${name.padEnd(34)} ${String(len).padStart(6)} chars`);
    }
    const branded = rows.filter(([, len]) => len > 3000).length;
    console.log(`\n${branded}/${rows.length} templates are the branded build`);
  });
' <<< "$response"

echo "pushed to project $PROJECT_REF"
