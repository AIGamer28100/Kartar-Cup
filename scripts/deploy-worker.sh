#!/usr/bin/env bash
# Deploys the Places proxy Worker and stores the Google key as a Worker secret.
#
# Auth, pick one (the script checks for you):
#   CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment  (CI / headless)
#   npx wrangler login                                               (a machine with a browser)
#
# Usage:  scripts/deploy-worker.sh
# Then put the printed URL in VITE_PLACES_PROXY_URL and rebuild + redeploy the site (README section 5).
set -euo pipefail
cd "$(dirname "$0")/.."

# Credentials, if they were dropped in a file instead of exported (git-ignored, never committed).
if [[ -f worker/places-proxy/.cf.env ]]; then
  set -a; . worker/places-proxy/.cf.env; set +a
fi
# The Google key: prefer the environment, else the local Worker dev file.
if [[ -z "${GOOGLE_PLACES_API_KEY:-}" && -f worker/places-proxy/.dev.vars ]]; then
  GOOGLE_PLACES_API_KEY="$(sed -n 's/^GOOGLE_PLACES_API_KEY=//p' worker/places-proxy/.dev.vars | head -1)"
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if ! npx wrangler whoami >/dev/null 2>&1; then
    echo "Not authenticated with Cloudflare." >&2
    echo "Either export CLOUDFLARE_API_TOKEN (Edit Cloudflare Workers template) and CLOUDFLARE_ACCOUNT_ID," >&2
    echo "or run: npx wrangler login" >&2
    exit 1
  fi
fi

cd worker/places-proxy
echo "== Worker secret: GOOGLE_PLACES_API_KEY =="
if [[ -n "${GOOGLE_PLACES_API_KEY:-}" ]]; then
  printf '%s' "$GOOGLE_PLACES_API_KEY" | npx wrangler secret put GOOGLE_PLACES_API_KEY
else
  echo "GOOGLE_PLACES_API_KEY is not set; wrangler will prompt for it."
  npx wrangler secret put GOOGLE_PLACES_API_KEY
fi

echo "== Deploy =="
npx wrangler deploy

cat <<'NEXT'

Next:
  1. Copy the printed https://kartar-places-proxy.<subdomain>.workers.dev URL.
  2. Smoke-test it:   PROXY=<that url> ORIGIN=https://kartar-cup.web.app npm run worker:smoke
  3. Rebuild the site with it and redeploy hosting:
       VITE_PLACES_PROXY_URL=<that url> npm run build && npm run deploy
NEXT
