#!/usr/bin/env bash
# Points the app at the local Supabase stack: writes its URL and publishable
# key into .env.local, which overrides .env (delete it to go back to the
# remote project). Run after `bun run db:start`.
set -euo pipefail
cd "$(dirname "$0")/.."

status="$(bunx supabase status -o env)"
value() { sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}$/\1/p" <<<"$status" | head -n1; }

url="$(value API_URL)"
# Newer CLIs print the publishable key; older ones only the anon key.
key="$(value PUBLISHABLE_KEY)"
key="${key:-$(value ANON_KEY)}"

if [[ -z "$url" || -z "$key" ]]; then
  echo "Local Supabase isn't running: start it with 'bun run db:start'." >&2
  exit 1
fi

cat > .env.local <<ENV
# Local Supabase (written by scripts/local-env.sh).
PUBLIC_SUPABASE_URL=$url
PUBLIC_SUPABASE_PUBLISHABLE_KEY=$key
ENV
echo "Wrote .env.local for $url"
