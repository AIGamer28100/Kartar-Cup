# kartar-openf1-live (paid OpenF1 live lap count, DORMANT by default)

A Cloudflare Worker that logs in to OpenF1's paid API with credentials only the Worker knows, and serves the
current race lap to signed-in app users. Until it is switched on, the app is on the free tier: OpenF1 returns no
data from 30 minutes before a session until 30 minutes after, so the host types the current lap into the host console.

- Endpoint: `GET /v1/live/lap?session_key=latest|<int>` (Firebase ID token required, exact-origin CORS allow-list).
- Response: `{configured:true, sessionKey, sessionName, sessionType, lap, leaderNumber|null, updatedAt, source:'openf1-live'}`.
  `lap` is the highest `lap_number` among laps that started in the last 10 minutes; `leaderNumber` is the driver who started that lap first.
- Secrets not set: `503 {configured:false, error:'OpenF1 live access is not configured'}` (the app treats this as "fall back to manual").
- Upstream failure: `502`. A rejected token is re-minted once. Bearer token is cached until 60 s before expiry (single-flight),
  and the lap result is cached 3 s, so upstream traffic is at most ~20 req/min however many hosts poll (cap is 60/min).
- Scope: REST polling only. OpenF1's MQTT/WebSocket feeds are intentionally not used.

## Cost and access

OpenF1 "Sponsor" tier is EUR 9.90/month: 6 req/s and 60 req/min (free: 3 req/s, 30/min), live data about 3 s behind.
Access is requested by the OWNER through the form https://tally.so/r/w2yWDb (details: https://openf1.org/auth.html).
You receive a username and password.

## Switch it on (5 steps)

1. Get credentials from OpenF1 (form above), and have Cloudflare auth ready (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, or `npx wrangler login`).
2. Set the two Worker secrets: `npm run worker:live:secret` (prompts for `OPENF1_USERNAME` then `OPENF1_PASSWORD`).
   Or let step 3 do it: export both variables, or put them in `worker/openf1-live/.dev.vars` (git-ignored; see `.dev.vars.example`).
3. Deploy the Worker: `scripts/deploy-live-worker.sh` (refuses to run without both credentials; prints the Worker URL).
   If you only want a redeploy after step 2, `npm run worker:live:deploy` works too.
4. Set the env var to the printed URL (no trailing slash): `VITE_OPENF1_LIVE_URL=https://kartar-openf1-live.<subdomain>.workers.dev`
   (build environment or `.env`). Optionally smoke-test first: `LIVE=<url> ORIGIN=https://kartar-cup.web.app npm run worker:live:smoke`.
5. Rebuild and redeploy the site: `npm run build && npm run deploy`. Then apply the snippet below (once) so the host console uses it.

## Roll back

Unset `VITE_OPENF1_LIVE_URL` (leave it empty) and rebuild/redeploy. `pickLiveLapSource()` then returns the manual source and the
Worker is never called. To also stop the Worker answering, delete it in the Cloudflare dashboard or remove the secrets
(`npx wrangler secret delete OPENF1_USERNAME` / `OPENF1_PASSWORD`), after which it returns 503.

## Wiring the host console

Not applied yet (the host console files were being edited elsewhere). In the host console component that owns the
"current lap" state, add (adjust `setCurrentLap` / `raceLive` to the real names):

```tsx
import { pickLiveLapSource, useLiveLap } from '../../lib/liveRace';

const liveLapSource = pickLiveLapSource('openf1-live'); // manual unless VITE_OPENF1_LIVE_URL is set
useLiveLap({
  source: liveLapSource,
  enabled: raceLive && liveLapSource.id !== 'manual', // only while the race is live
  onLap: (lap) => setCurrentLap(lap),                  // fires only when the lap increases; host can still type over it
});
```

Show `liveLapSource.label` next to the lap input so the host knows whether the lap is automatic.
`onLap` fires only on increases, so a manual correction downwards is never overwritten by a stale value.

## Local development

`cp .dev.vars.example .dev.vars`, fill the two values, `npm run worker:live:dev` (port 8788), then
`npm run worker:live:smoke`. Tests (mock upstream only): `npx vitest run src/lib/liveRace`.

The real paid API has not been exercised by this code; verify with real credentials during a live session.
