// OpenF1 paid live-data proxy for the Kartar Cup host console. DORMANT until the owner sets the
// Worker secrets OPENF1_USERNAME / OPENF1_PASSWORD (then it serves the current race lap).
// The OpenF1 credentials live ONLY here; the browser never sees them. Setup: README.md.
// Callers must send a Firebase ID token of any signed-in user (the data is public sports data and
// the 3 s result cache bounds upstream traffic).

import { JWKS_URL, verifyFirebaseIdToken } from './verify.js';
import { UpstreamError, createLiveClient } from './live.js';

const RATE_LIMIT = 60; // requests per uid per minute, per Worker isolate
const rate = new Map(); // uid -> { windowStart, count }
let jwksCache = { at: 0, jwks: null };
const client = createLiveClient();

async function getJwks(force = false) {
  if (!force && jwksCache.jwks && Date.now() - jwksCache.at < 60 * 60 * 1000) return jwksCache.jwks;
  // Forced refetch (Google rotated its signing keys) must bypass Cloudflare's edge cache too.
  const res = await fetch(JWKS_URL, force ? { cache: 'no-store' } : { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error('jwks unavailable');
  jwksCache = { at: Date.now(), jwks: await res.json() };
  return jwksCache.jwks;
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!origin || !allowed.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body, status, cors) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(cors ?? {}) },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request.headers.get('Origin'), env);

    if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
    if (request.method !== 'GET') return json({ status: 'METHOD_NOT_ALLOWED' }, 405, cors);
    // Browsers always send Origin on cross-origin calls; reject any that is not on the allow-list.
    if (request.headers.get('Origin') && !cors) return json({ status: 'ORIGIN_NOT_ALLOWED' }, 403, null);
    if (!env.FIREBASE_PROJECT_ID) return json({ status: 'NOT_CONFIGURED' }, 500, cors);

    const match = /^Bearer (.+)$/.exec(request.headers.get('Authorization') ?? '');
    if (!match) return json({ status: 'UNAUTHENTICATED' }, 401, cors);
    const idToken = match[1];

    let payload;
    try {
      payload = await verifyFirebaseIdToken(idToken, { projectId: env.FIREBASE_PROJECT_ID, jwks: await getJwks() });
    } catch (e) {
      // Unknown key id = Google probably rotated keys: refetch once instead of 401-ing everyone for an hour.
      if (!String(e?.message).includes('unknown key')) return json({ status: 'UNAUTHENTICATED' }, 401, cors);
      try {
        payload = await verifyFirebaseIdToken(idToken, { projectId: env.FIREBASE_PROJECT_ID, jwks: await getJwks(true) });
      } catch {
        return json({ status: 'UNAUTHENTICATED' }, 401, cors);
      }
    }
    const slot = rate.get(payload.sub);
    if (!slot || Date.now() - slot.windowStart > 60_000) rate.set(payload.sub, { windowStart: Date.now(), count: 1 });
    else if (++slot.count > RATE_LIMIT) return json({ status: 'RATE_LIMITED' }, 429, cors);

    if (url.pathname !== '/v1/live/lap') return json({ status: 'NOT_FOUND' }, 404, cors);

    if (!env.OPENF1_USERNAME || !env.OPENF1_PASSWORD) {
      return json({ configured: false, error: 'OpenF1 live access is not configured' }, 503, cors);
    }

    const raw = (url.searchParams.get('session_key') ?? 'latest').trim();
    if (raw !== 'latest' && !/^[0-9]{1,9}$/.test(raw)) return json({ status: 'INVALID_REQUEST' }, 400, cors);

    try {
      return json(await client.getLap(env, raw), 200, cors);
    } catch (e) {
      if (!(e instanceof UpstreamError)) console.error('openf1-live internal error', e?.message);
      return json({ status: 'UPSTREAM_ERROR' }, 502, cors);
    }
  },
};
