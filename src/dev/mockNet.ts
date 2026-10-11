/**
 * Dev-only fetch interceptor for the Mock Lab. Patches globalThis.fetch so the app's OpenF1, Jolpica,
 * Open-Meteo, image and Places-proxy calls are answered from captured real payloads (fixtures/net)
 * with no network, and so failure modes (empty data, 429, offline) can be switched on demand.
 * Hosts it does not own fall through to the real fetch untouched; an owned host never reaches the network.
 */
import driversRace from './fixtures/net/drivers.race.json';
import driversQuali from './fixtures/net/drivers.quali.json';
import jolpicaSchedule from './fixtures/net/jolpica.schedule.json';
import jolpicaDrivers from './fixtures/net/jolpica.driverStandings.json';
import jolpicaConstructors from './fixtures/net/jolpica.constructorStandings.json';
import lapsRace from './fixtures/net/laps.race.json';
import meetingsDone from './fixtures/net/meetings.done.json';
import meetingsNext from './fixtures/net/meetings.next.json';
import meteoForecast from './fixtures/net/meteo.forecast.json';
import placesAutocomplete from './fixtures/net/places.autocomplete.json';
import placesDetails from './fixtures/net/places.details.json';
import resultRace from './fixtures/net/session_result.race.json';
import resultQuali from './fixtures/net/session_result.quali.json';
import sessionsDone from './fixtures/net/sessions.done.json';
import sessionsNext from './fixtures/net/sessions.next.json';
import sessionsRaceYear from './fixtures/net/sessions.raceYear.json';
import stintsRace from './fixtures/net/stints.race.json';
import stintsQuali from './fixtures/net/stints.quali.json';
import weatherRace from './fixtures/net/weather.race.json';
import weatherQuali from './fixtures/net/weather.quali.json';

export type Scenario =
  | 'completed' // Malaysia payloads: finished race, full results, podium, laps, stints
  | 'upcoming' // Singapore payloads: sessions in the future, no results yet
  | 'no-data' // every OpenF1 array comes back empty (future session, the common real case)
  | 'rate-limited' // OpenF1 answers 429 on every call
  | 'offline'; // every intercepted fetch rejects with a TypeError, like a dropped network

export interface MockCall {
  at: number;
  url: string;
  status: number | 'reject';
  served: string;
}
export interface MockNetState {
  installed: boolean;
  scenario: Scenario;
  calls: MockCall[];
}

const MAX_CALLS = 200;
const DONE_MEETING = 1308;
const NEXT_MEETING = 1296;
const RACE_SESSION = 11731;
const QUALI_SESSION = 11730;

/** Inline placeholder so headshots and photos never load from the network. */
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">' +
  '<rect width="200" height="200" fill="#2a2a2e"/><circle cx="100" cy="78" r="34" fill="#4a4a52"/>' +
  '<path d="M36 184c6-42 34-62 64-62s58 20 64 62z" fill="#4a4a52"/></svg>';

const IMAGE_HOSTS = new Set(['media.formula1.com', 'picsum.photos']);

let original: typeof fetch | null = null;
let installed = false;
let scenario: Scenario = 'completed';
let calls: MockCall[] = [];

interface Hit {
  body: unknown;
  served: string;
}

const bySession = (q: URLSearchParams, map: Record<number, unknown>, name: string): Hit | null => {
  const key = Number(q.get('session_key'));
  return key in map ? { body: map[key], served: `${name}.${key === RACE_SESSION ? 'race' : 'quali'}` } : null;
};

/** Picks the OpenF1 fixture for a path + query, or null when nothing captured answers it. */
function openf1(path: string, q: URLSearchParams): Hit | null {
  if (path === '/sessions') {
    const mk = Number(q.get('meeting_key'));
    const type = q.get('session_type');
    const only = (rows: { session_type: string }[]) => (type ? rows.filter((r) => r.session_type === type) : rows);
    if (mk === DONE_MEETING) return { body: only(sessionsDone), served: 'sessions.done' };
    if (mk === NEXT_MEETING) return { body: only(sessionsNext), served: 'sessions.next' };
    if (type === 'Race') return { body: sessionsRaceYear, served: 'sessions.raceYear' };
    return null;
  }
  if (path === '/meetings') {
    const mk = Number(q.get('meeting_key'));
    if (mk === DONE_MEETING) return { body: meetingsDone, served: 'meetings.done' };
    if (mk === NEXT_MEETING) return { body: meetingsNext, served: 'meetings.next' };
    return null;
  }
  // Session-keyed data exists only for the finished weekend; an upcoming session has none yet.
  if (scenario === 'upcoming') return null;
  const race = RACE_SESSION;
  const quali = QUALI_SESSION;
  switch (path) {
    case '/drivers': return bySession(q, { [race]: driversRace, [quali]: driversQuali }, 'drivers');
    case '/session_result': return bySession(q, { [race]: resultRace, [quali]: resultQuali }, 'session_result');
    case '/weather': return bySession(q, { [race]: weatherRace, [quali]: weatherQuali }, 'weather');
    case '/stints': return bySession(q, { [race]: stintsRace, [quali]: stintsQuali }, 'stints');
    case '/laps': return bySession(q, { [race]: lapsRace }, 'laps');
    default: return null;
  }
}

function jolpica(path: string): Hit | null {
  if (/\/driverstandings\.json$/.test(path)) return { body: jolpicaDrivers, served: 'jolpica.driverStandings' };
  if (/\/constructorstandings\.json$/.test(path)) return { body: jolpicaConstructors, served: 'jolpica.constructorStandings' };
  if (/\/ergast\/f1\/\d{4}\.json$/.test(path)) return { body: jolpicaSchedule, served: 'jolpica.schedule' };
  return null;
}

function placesOrigin(): string | null {
  const raw = (import.meta.env.VITE_PLACES_PROXY_URL ?? '') as string;
  try {
    return raw ? new URL(raw).origin : null;
  } catch {
    return null;
  }
}

function record(url: string, status: number | 'reject', served: string): void {
  calls.push({ at: Date.now(), url, status, served });
  if (calls.length > MAX_CALLS) calls = calls.slice(-MAX_CALLS);
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const raw = requestUrl(input);
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return original!(input, init);
  }
  const host = u.hostname;
  const isPlaces = u.origin === placesOrigin();
  const owned = host === 'api.openf1.org' || host === 'api.jolpi.ca' || host === 'api.open-meteo.com' || IMAGE_HOSTS.has(host) || isPlaces;
  if (!owned) return original!(input, init);

  if (scenario === 'offline') {
    record(raw, 'reject', 'offline');
    throw new TypeError('Failed to fetch');
  }

  const q = u.searchParams;
  const path = u.pathname.replace(/\/+$/, '');

  if (IMAGE_HOSTS.has(host)) {
    record(raw, 200, 'svg-placeholder');
    return new Response(PLACEHOLDER_SVG, { status: 200, headers: { 'content-type': 'image/svg+xml' } });
  }

  let hit: Hit | null = null;
  if (host === 'api.openf1.org') {
    const p = path.replace(/^\/v1/, '');
    if (scenario === 'rate-limited') {
      record(raw, 429, 'rate-limited');
      return json({ detail: 'Rate limit exceeded' }, 429);
    }
    if (scenario === 'no-data') {
      record(raw, 200, 'no-data');
      return json([]);
    }
    hit = openf1(p, q);
  } else if (host === 'api.jolpi.ca') {
    hit = jolpica(path);
  } else if (host === 'api.open-meteo.com') {
    if (path === '/v1/forecast') hit = { body: meteoForecast, served: 'meteo.forecast' };
  } else if (isPlaces) {
    if (path.endsWith('/autocomplete')) hit = { body: placesAutocomplete, served: 'places.autocomplete' };
    else if (path.endsWith('/details')) hit = { body: placesDetails, served: 'places.details' };
  }

  if (!hit) {
    record(raw, 200, 'empty-fallback');
    return json([]);
  }
  record(raw, 200, hit.served);
  return json(hit.body);
}

export function uninstallMockNet(): void {
  // Restore unconditionally: a panel's own fetch shim may sit on top, and leaving fixtures wired in would strand the page.
  if (original) globalThis.fetch = original;
  original = null;
  installed = false;
}

/** Patches globalThis.fetch. Idempotent. Returns the uninstall function. */
export function installMockNet(s: Scenario): () => void {
  scenario = s;
  if (!installed) {
    original = globalThis.fetch;
    globalThis.fetch = mockFetch as typeof fetch;
    installed = true;
  }
  return uninstallMockNet;
}

export function setScenario(s: Scenario): void {
  scenario = s;
}

export function getMockNetState(): MockNetState {
  return { installed, scenario, calls: [...calls] };
}

/** Clears raceData's sessionStorage cache ("rd:" and "jolpica:" keys) so a scenario change takes effect. */
export function clearNetCaches(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && (k.startsWith('rd:') || k.startsWith('jolpica:'))) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* storage unavailable */
  }
}
