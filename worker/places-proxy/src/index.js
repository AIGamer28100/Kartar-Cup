// Google Places proxy for the Kartar Cup host console.
// The Google API key lives ONLY here (Worker secret GOOGLE_PLACES_API_KEY); the browser never sees it.
// Callers must send a Firebase ID token of someone who can run bookings. Setup: README.md section 4.

import { JWKS_URL, canRunBookings, verifyFirebaseIdToken } from './verify.js';

const GOOGLE = 'https://maps.googleapis.com/maps/api/place';
const AUTH_CACHE_MS = 60 * 1000; // short, so a removed host loses access within a minute
const RATE_LIMIT = 30; // requests per uid per minute, per Worker isolate (add a Cloudflare rate rule for a hard global limit)
const rate = new Map(); // uid -> { windowStart, count }
const authCache = new Map(); // uid -> expiry ms (only successes are cached)
let jwksCache = { at: 0, jwks: null };

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
    if (!env.GOOGLE_PLACES_API_KEY || !env.FIREBASE_PROJECT_ID) return json({ status: 'NOT_CONFIGURED' }, 500, cors);

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
    if ((authCache.get(payload.sub) ?? 0) < Date.now()) {
      const ok = await canRunBookings(payload, idToken, { projectId: env.FIREBASE_PROJECT_ID }).catch(() => false);
      if (!ok) return json({ status: 'FORBIDDEN' }, 403, cors);
      authCache.set(payload.sub, Date.now() + AUTH_CACHE_MS);
    }

    let target;
    if (url.pathname === '/autocomplete') {
      const input = (url.searchParams.get('input') ?? '').trim();
      if (input.length < 3 || input.length > 100) return json({ status: 'INVALID_REQUEST' }, 400, cors);
      target = `${GOOGLE}/autocomplete/json?input=${encodeURIComponent(input)}&language=en&components=country:in`;
    } else if (url.pathname === '/details') {
      const placeId = url.searchParams.get('place_id') ?? '';
      if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return json({ status: 'INVALID_REQUEST' }, 400, cors);
      target = `${GOOGLE}/details/json?place_id=${encodeURIComponent(placeId)}&fields=geometry`;
    } else {
      return json({ status: 'NOT_FOUND' }, 404, cors);
    }

    const res = await fetch(`${target}&key=${env.GOOGLE_PLACES_API_KEY}`);
    if (!res.ok) return json({ status: 'UPSTREAM_ERROR' }, 502, cors);
    const data = await res.json();
    // Never echo anything that could carry the key; pass through only what the app reads.
    return json({ status: data.status, error_message: data.error_message, predictions: data.predictions, result: data.result && { geometry: data.result.geometry } }, 200, cors);
  },
};
