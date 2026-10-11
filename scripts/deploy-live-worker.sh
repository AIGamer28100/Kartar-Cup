#!/usr/bin/env bash
# Deploys the OpenF1 live Worker and stores the OpenF1 credentials as Worker secrets.
# Refuses to run unless OPENF1_USERNAME and OPENF1_PASSWORD are provided (never echoed).
#
# Auth, pick one (the script checks for you):
#   CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment  (CI / headless)
#   npx wrangler login                                               (a machine with a browser)
#
# Usage:  OPENF1_USERNAME=... OPENF1_PASSWORD=... scripts/deploy-live-worker.sh
#   or put both in worker/openf1-live/.dev.vars (git-ignored) and run scripts/deploy-live-worker.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f worker/openf1-live/.cf.env ]]; then
  set -a; . worker/openf1-live/.cf.env; set +a
fi
if [[ -z "${OPENF1_USERNAME:-}" && -f worker/openf1-live/.dev.vars ]]; then
  OPENF1_USERNAME="$(sed -n 's/^OPENF1_USERNAME=//p' worker/openf1-live/.dev.vars | head -1)"
fi
if [[ -z "${OPENF1_PASSWORD:-}" && -f worker/openf1-live/.dev.vars ]]; then
  OPENF1_PASSWORD="$(sed -n 's/^OPENF1_PASSWORD=//p' worker/openf1-live/.dev.vars | head -1)"
fi
if [[ -z "${OPENF1_USERNAME:-}" || -z "${OPENF1_PASSWORD:-}" ]]; then
  echo "Refusing to deploy: OPENF1_USERNAME and OPENF1_PASSWORD must both be set" >&2
  echo "(environment variables, or worker/openf1-live/.dev.vars). Access is requested at https://tally.so/r/w2yWDb" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  if ! npx wrangler whoami >/dev/null 2>&1; then
    echo "Not authenticated with Cloudflare." >&2
    echo "Either export CLOUDFLARE_API_TOKEN (Edit Cloudflare Workers template) and CLOUDFLARE_ACCOUNT_ID," >&2
    echo "or run: npx wrangler login" >&2
    exit 1
  fi
fi

cd worker/openf1-live
echo "== Worker secrets: OPENF1_USERNAME, OPENF1_PASSWORD =="
printf '%s' "$OPENF1_USERNAME" | npx wrangler secret put OPENF1_USERNAME >/dev/null
printf '%s' "$OPENF1_PASSWORD" | npx wrangler secret put OPENF1_PASSWORD >/dev/null
echo "secrets stored"

echo "== Deploy =="
npx wrangler deploy

cat <<'NEXT'

Next:
  1. Copy the printed https://kartar-openf1-live.<subdomain>.workers.dev URL: it is the value for
     VITE_OPENF1_LIVE_URL (no trailing slash).
  2. Smoke-test it:   LIVE=<that url> ORIGIN=https://kartar-cup.web.app npm run worker:live:smoke
  3. Rebuild the site with it and redeploy hosting:
       VITE_OPENF1_LIVE_URL=<that url> npm run build && npm run deploy
NEXT
