import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain-JS Worker modules, no types
import { RESULT_TTL_MS, createLiveClient, latestLap } from '../../../worker/openf1-live/src/live.js';
// @ts-expect-error plain-JS Worker module, no types
import worker from '../../../worker/openf1-live/src/index.js';
import lapsFixture from '../../dev/fixtures/net/laps.race.json';

interface Lap { lap_number: number; driver_number: number; date_start: string; session_key: number }
const laps = lapsFixture as Lap[];
const ENV = { OPENF1_USERNAME: 'u', OPENF1_PASSWORD: 'p' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const NOW0 = Date.parse('2026-10-04T08:49:30Z'); // 29 s after the last captured lap start

/** Fake OpenF1: applies the date_start>= filter like the real API. */
function fakeOpenF1(opts: { expiresIn?: string; rejectFirstBearer?: boolean } = {}) {
  const calls = { token: 0, laps: 0, sessions: 0 };
  let minted = 0;
  const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/token')) {
      calls.token++;
      await Promise.resolve();
      return json({ expires_in: opts.expiresIn ?? '3600', access_token: `tok${++minted}`, token_type: 'bearer' });
    }
    const bearer = (init?.headers as Record<string, string> | undefined)?.Authorization;
    if (opts.rejectFirstBearer && bearer === 'Bearer tok1') return json({ detail: 'expired' }, 401);
    if (url.includes('/v1/sessions')) {
      calls.sessions++;
      return json([{ session_key: 11731, session_name: 'Race', session_type: 'Race' }]);
    }
    calls.laps++;
    const since = Date.parse(/date_start>=([^&]+)/.exec(url)![1]);
    return json(laps.filter((l) => Date.parse(l.date_start) >= since));
  });
  return { fetchFn, calls };
}

describe('latestLap', () => {
  it('is the max lap_number and the first driver to start it', () => {
    expect(latestLap(laps)).toEqual({ lap: 55, leaderNumber: 3 });
  });
  it('is null for no laps and ignores junk rows', () => {
    expect(latestLap([])).toEqual({ lap: null, leaderNumber: null });
    expect(latestLap([{ lap_number: null }, { lap_number: 'x' }, {}])).toEqual({ lap: null, leaderNumber: null });
  });
});

describe('live client', () => {
  it('computes the lap from only the last 10 minutes of laps', async () => {
    const { fetchFn } = fakeOpenF1();
    const c = createLiveClient({ fetchFn, now: () => NOW0 });
    const r = await c.getLap(ENV, 'latest');
    expect(r).toMatchObject({ configured: true, sessionKey: 11731, sessionName: 'Race', sessionType: 'Race', lap: 55, leaderNumber: 3, source: 'openf1-live' });
    expect(r.updatedAt).toBe(new Date(NOW0).toISOString());
    // At 08:49:30 the window starts 08:39:30: lap 55 only, far fewer rows than the full race.
    const lapsUrl = fetchFn.mock.calls.map((x) => x[0]).find((u) => u.includes('/v1/laps'))!;
    expect(lapsUrl).toContain('date_start>=2026-10-04T08:39:30.000Z');
  });

  it('reports lap null when nothing started in the window', async () => {
    const { fetchFn } = fakeOpenF1();
    const c = createLiveClient({ fetchFn, now: () => NOW0 + 3 * 3600_000 });
    expect((await c.getLap(ENV, 'latest')).lap).toBeNull();
  });

  it('caches the result for 3 s then refetches', async () => {
    let t = NOW0;
    const { fetchFn, calls } = fakeOpenF1();
    const c = createLiveClient({ fetchFn, now: () => t });
    await Promise.all([c.getLap(ENV, 'latest'), c.getLap(ENV, 'latest'), c.getLap(ENV, 'latest')]);
    t += RESULT_TTL_MS - 1;
    await c.getLap(ENV, 'latest');
    expect(calls.laps).toBe(1);
    t += 2;
    await c.getLap(ENV, 'latest');
    expect(calls.laps).toBe(2);
    expect(calls.sessions).toBe(1); // session meta cached longer
  });

  it('mints one token for concurrent requests and reuses it until 60 s before expiry', async () => {
    let t = NOW0;
    const { fetchFn, calls } = fakeOpenF1({ expiresIn: '3600' });
    const c = createLiveClient({ fetchFn, now: () => t });
    await Promise.all([c.getLap(ENV, '1'), c.getLap(ENV, '2'), c.getLap(ENV, '3')]);
    expect(calls.token).toBe(1);
    t += 3600_000 - 61_000;
    await c.getLap(ENV, '1');
    expect(calls.token).toBe(1);
    t += 5_000; // now inside the 60 s skew (and past the 3 s result cache)
    await c.getLap(ENV, '1');
    expect(calls.token).toBe(2);
  });

  it('re-mints once when the token is rejected, then fails with 502-class error if still rejected', async () => {
    const a = fakeOpenF1({ rejectFirstBearer: true });
    const c = createLiveClient({ fetchFn: a.fetchFn, now: () => NOW0 });
    await expect(c.getLap(ENV, 'latest')).resolves.toMatchObject({ lap: 55 });
    expect(a.calls.token).toBe(2);

    const fetchFn = vi.fn(async (url: string) => (url.endsWith('/token') ? json({ expires_in: '3600', access_token: 't' }) : json({}, 401)));
    const c2 = createLiveClient({ fetchFn, now: () => NOW0 });
    await expect(c2.getLap(ENV, 'latest')).rejects.toThrow();
    expect(fetchFn.mock.calls.filter((x) => String(x[0]).endsWith('/token'))).toHaveLength(2);
  });

  it('does not cache failures', async () => {
    let fail = true;
    const ok = fakeOpenF1();
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => (fail && !url.endsWith('/token') ? json({}, 500) : ok.fetchFn(url, init)));
    const c = createLiveClient({ fetchFn, now: () => NOW0 });
    await expect(c.getLap(ENV, 'latest')).rejects.toThrow();
    fail = false;
    await expect(c.getLap(ENV, 'latest')).resolves.toMatchObject({ lap: 55 });
  });
});

// --- full Worker: auth + 503/502 behaviour -------------------------------------------------------
const b64u = (b: ArrayBuffer | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function idToken() {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', kid: 'k1' }));
  const body = b64u(JSON.stringify({ aud: 'kartar-cup', iss: 'https://securetoken.google.com/kartar-cup', sub: 'u1', iat: now - 5, exp: now + 3600 }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${head}.${body}`));
  const jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1' };
  return { token: `${head}.${body}.${b64u(sig)}`, jwks: { keys: [jwk] } };
}

describe('worker fetch handler', () => {
  afterEach(() => vi.unstubAllGlobals());
  const base = { FIREBASE_PROJECT_ID: 'kartar-cup', ALLOWED_ORIGINS: 'https://kartar-cup.web.app' };
  const req = (token?: string, method = 'GET', path = '/v1/live/lap') =>
    new Request(`https://w.example${path}`, { method, headers: { Origin: 'https://kartar-cup.web.app', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });

  it('rejects missing token, bad origin and non-GET', async () => {
    expect((await worker.fetch(req(), base)).status).toBe(401);
    expect((await worker.fetch(req('x.y.z', 'POST'), base)).status).toBe(405);
    const evil = new Request('https://w.example/v1/live/lap', { headers: { Origin: 'https://evil.example' } });
    expect((await worker.fetch(evil, base)).status).toBe(403);
  });

  it('answers 503 {configured:false} when the secrets are not set, and 502 on upstream failure', async () => {
    const { token, jwks } = await idToken();
    const upstream = vi.fn(async (url: string) => (String(url).includes('googleapis.com/service_accounts') ? json(jwks) : json({}, 500)));
    vi.stubGlobal('fetch', upstream);
    const unconfigured = await worker.fetch(req(token), base);
    expect(unconfigured.status).toBe(503);
    expect(await unconfigured.json()).toEqual({ configured: false, error: 'OpenF1 live access is not configured' });
    expect(upstream.mock.calls.some((c) => String(c[0]).includes('openf1.org'))).toBe(false);

    const failed = await worker.fetch(req(token), { ...base, ...ENV });
    expect(failed.status).toBe(502);
    expect((await worker.fetch(req(token, 'GET', '/v1/live/lap?session_key=abc'), { ...base, ...ENV })).status).toBe(400);
  });
});
