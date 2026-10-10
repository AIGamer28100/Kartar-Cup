// OpenF1 paid-tier access: bearer-token minting/caching, and the "current lap" computation.
// Pure logic with injectable fetch/clock so it is unit-testable (src/lib/liveRace/openf1LiveWorker.test.ts).

const API = 'https://api.openf1.org';
const TOKEN_SKEW_MS = 60 * 1000; // re-mint 60 s before expiry
export const RESULT_TTL_MS = 3000; // lap result cache: bounds upstream traffic whatever the number of pollers
export const SESSION_TTL_MS = 60 * 1000; // session name/type barely change
export const WINDOW_MS = 10 * 60 * 1000; // only fetch laps that started in the last 10 minutes
const MAX_CACHE_KEYS = 16;

export class UpstreamError extends Error {}

/** Module-scope state; tests pass their own via createLiveClient(). */
export function createLiveClient({ fetchFn = (...a) => fetch(...a), now = () => Date.now() } = {}) {
  let token = null; // { value, expiresAt }
  let minting = null; // in-flight mint promise (single-flight)
  const results = new Map(); // key -> { at, body } | { at, promise }
  const sessions = new Map(); // key -> { at, info }

  async function mint(env) {
    const res = await fetchFn(`${API}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: env.OPENF1_USERNAME, password: env.OPENF1_PASSWORD }).toString(),
    });
    if (!res.ok) throw new UpstreamError(`token ${res.status}`);
    const data = await res.json();
    const ttl = Number(data?.expires_in);
    if (typeof data?.access_token !== 'string' || !data.access_token) throw new UpstreamError('token shape');
    token = { value: data.access_token, expiresAt: now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : 3600) * 1000 };
    return token.value;
  }

  function getToken(env, force = false) {
    if (!force && token && token.expiresAt - TOKEN_SKEW_MS > now()) return Promise.resolve(token.value);
    if (!minting) minting = mint(env).finally(() => { minting = null; });
    return minting;
  }

  /** GET an OpenF1 REST path with the bearer token; on 401 re-mint once and retry. */
  async function api(env, pathAndQuery) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const t = await getToken(env, attempt > 0);
      const res = await fetchFn(`${API}${pathAndQuery}`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401 && attempt === 0) { token = null; continue; }
      if (!res.ok) throw new UpstreamError(`openf1 ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new UpstreamError('openf1 shape');
      return data;
    }
    throw new UpstreamError('openf1 unauthorized');
  }

  async function sessionInfo(env, key) {
    const hit = sessions.get(key);
    if (hit && now() - hit.at < SESSION_TTL_MS) return hit.info;
    const rows = await api(env, `/v1/sessions?session_key=${encodeURIComponent(key)}`);
    const s = rows[rows.length - 1];
    const info = {
      sessionKey: Number.isInteger(s?.session_key) ? s.session_key : null,
      sessionName: typeof s?.session_name === 'string' ? s.session_name : null,
      sessionType: typeof s?.session_type === 'string' ? s.session_type : null,
    };
    trim(sessions);
    sessions.set(key, { at: now(), info });
    return info;
  }

  function trim(map) {
    while (map.size >= MAX_CACHE_KEYS) map.delete(map.keys().next().value);
  }

  async function compute(env, key) {
    const info = await sessionInfo(env, key);
    const since = new Date(now() - WINDOW_MS).toISOString();
    const laps = await api(env, `/v1/laps?session_key=${encodeURIComponent(key)}&date_start>=${since}`);
    const { lap, leaderNumber } = latestLap(laps);
    return {
      configured: true,
      sessionKey: info.sessionKey,
      sessionName: info.sessionName,
      sessionType: info.sessionType,
      lap,
      leaderNumber,
      updatedAt: new Date(now()).toISOString(),
      source: 'openf1-live',
    };
  }

  /** Cached (3 s) and single-flight per session key. Throws UpstreamError on upstream failure. */
  function getLap(env, key) {
    const hit = results.get(key);
    if (hit && (hit.promise || now() - hit.at < RESULT_TTL_MS)) return hit.promise ?? Promise.resolve(hit.body);
    const promise = compute(env, key).then(
      (body) => { results.set(key, { at: now(), body }); return body; },
      (e) => { results.delete(key); throw e; },
    );
    trim(results);
    results.set(key, { at: now(), promise });
    return promise;
  }

  return { getLap, getToken };
}

/** lap = highest lap_number; leaderNumber = driver who started that lap first (null if no laps). */
export function latestLap(laps) {
  let lap = null;
  let leaderNumber = null;
  let leaderStart = Infinity;
  for (const l of laps) {
    if (!Number.isInteger(l?.lap_number) || l.lap_number < 1) continue;
    const start = Date.parse(l.date_start);
    const s = Number.isFinite(start) ? start : Infinity;
    if (lap === null || l.lap_number > lap) {
      lap = l.lap_number;
      leaderNumber = Number.isInteger(l.driver_number) ? l.driver_number : null;
      leaderStart = s;
    } else if (l.lap_number === lap && s < leaderStart) {
      leaderNumber = Number.isInteger(l.driver_number) ? l.driver_number : null;
      leaderStart = s;
    }
  }
  return { lap, leaderNumber };
}
