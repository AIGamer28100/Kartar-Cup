/* R41: live-ish data for the race detail page - sessions, weather, results, tyres. Backbone is OpenF1
 * (keyless, CORS-open, CC BY-NC-SA 4.0 - show attribution). Free tier = 3 req/s, 30 req/min and NO data
 * from 30 min before a session until 30 min after it ends, so completed-session data is only requested
 * once that window has passed, every request goes through one paced queue, and results are cached. */

const BASE = 'https://api.openf1.org/v1';
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GAP_MS = 450;
const WINDOW_MS = 30 * 60 * 1000;

/* ---------- paced, cached fetching ---------- */

let tail: Promise<unknown> = Promise.resolve();
let lastAt = 0;
const mem = new Map<string, { at: number; v: unknown }>();

function queued<T>(job: () => Promise<T>): Promise<T> {
  const run = tail.then(async () => {
    const wait = Math.max(0, lastAt + GAP_MS - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    try {
      return await job();
    } finally {
      lastAt = Date.now();
    }
  });
  tail = run.catch(() => undefined);
  return run;
}

async function fetchJson<T>(url: string, tries = 3): Promise<T> {
  for (let i = 1; i <= tries; i++) {
    const res = await queued(() => fetch(url));
    if (res.status === 429 && i < tries) {
      await new Promise((r) => setTimeout(r, 2500 * i));
      continue;
    }
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return (await res.json()) as T;
  }
  throw new Error('Too many requests - try again in a minute.');
}

function readStore(key: string, ttl: number): unknown | undefined {
  try {
    const raw = sessionStorage.getItem(`rd:${key}`);
    if (!raw) return undefined;
    const { at, v } = JSON.parse(raw) as { at: number; v: unknown };
    return Date.now() - at < ttl ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Memory + sessionStorage cache. Storage may be unavailable or full: the page still works without it. */
async function cached<T>(url: string, ttl: number): Promise<T> {
  const hit = mem.get(url);
  if (hit && Date.now() - hit.at < ttl) return hit.v as T;
  const stored = readStore(url, ttl);
  if (stored !== undefined) {
    mem.set(url, { at: Date.now(), v: stored });
    return stored as T;
  }
  const v = await fetchJson<T>(url);
  mem.set(url, { at: Date.now(), v });
  try {
    sessionStorage.setItem(`rd:${url}`, JSON.stringify({ at: Date.now(), v }));
  } catch {
    /* quota or blocked storage */
  }
  return v;
}

const MIN = 60_000;
const HOUR = 60 * MIN;

/* ---------- sessions ---------- */

export interface RaceSession {
  key: number;
  name: string;
  type: string;
  startUtc: string;
  endUtc: string;
  /** Circuit UTC offset, e.g. "08:00:00". */
  gmtOffset: string;
  cancelled: boolean;
}
type RawSession = {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  gmt_offset?: string;
  is_cancelled?: boolean;
};

export async function fetchSessions(meetingKey: number): Promise<RaceSession[]> {
  const rows = await cached<RawSession[]>(`${BASE}/sessions?meeting_key=${meetingKey}`, 10 * MIN);
  return rows
    .map((r) => ({
      key: r.session_key,
      name: r.session_name,
      type: r.session_type,
      startUtc: r.date_start,
      endUtc: r.date_end,
      gmtOffset: r.gmt_offset ?? '00:00:00',
      cancelled: Boolean(r.is_cancelled),
    }))
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

export type SessionPhase = 'upcoming' | 'inprogress' | 'done';

/** 'done' only once the 30-minute free-data blackout after the session has passed. */
export function sessionPhase(s: Pick<RaceSession, 'startUtc' | 'endUtc'>, now = Date.now()): SessionPhase {
  const start = Date.parse(s.startUtc);
  const end = Date.parse(s.endUtc);
  if (now < start - WINDOW_MS) return 'upcoming';
  if (now <= end + WINDOW_MS) return 'inprogress';
  return 'done';
}

/** "08:00:00" / "-05:00:00" -> seconds. */
export function offsetSeconds(gmtOffset: string): number {
  const m = /^(-?)(\d{1,2}):(\d{2})/.exec(gmtOffset);
  if (!m) return 0;
  const s = Number(m[2]) * 3600 + Number(m[3]) * 60;
  return m[1] ? -s : s;
}

/* ---------- weather ---------- */

export interface WeatherSummary {
  airMin: number;
  airMax: number;
  trackMin: number | null;
  trackMax: number | null;
  humidity: number;
  windMax: number;
  rain: boolean;
}
type RawWeather = { air_temperature: number; track_temperature: number; humidity: number; wind_speed: number; rainfall: number };

export function summariseWeather(rows: RawWeather[]): WeatherSummary | null {
  if (!rows.length) return null;
  const air = rows.map((r) => r.air_temperature).filter((n) => Number.isFinite(n));
  const track = rows.map((r) => r.track_temperature).filter((n) => Number.isFinite(n));
  const hum = rows.map((r) => r.humidity).filter((n) => Number.isFinite(n));
  const wind = rows.map((r) => r.wind_speed).filter((n) => Number.isFinite(n));
  if (!air.length) return null;
  return {
    airMin: Math.min(...air),
    airMax: Math.max(...air),
    trackMin: track.length ? Math.min(...track) : null,
    trackMax: track.length ? Math.max(...track) : null,
    humidity: hum.length ? hum.reduce((a, b) => a + b, 0) / hum.length : 0,
    windMax: wind.length ? Math.max(...wind) : 0,
    rain: rows.some((r) => r.rainfall > 0),
  };
}

export async function fetchSessionWeather(sessionKey: number): Promise<WeatherSummary | null> {
  const rows = await cached<RawWeather[]>(`${BASE}/weather?session_key=${sessionKey}`, 24 * HOUR);
  return summariseWeather(rows);
}

export interface ForecastHour {
  /** Circuit-local time, "YYYY-MM-DDTHH:mm". */
  time: string;
  tempC: number;
  rainChance: number;
  windKmh: number;
  code: number;
}
interface RawForecast {
  utc_offset_seconds: number;
  hourly: { time: string[]; temperature_2m: number[]; precipitation_probability: number[]; wind_speed_10m: number[]; weather_code: number[] };
}

/** Hourly forecast at the circuit for a date span (YYYY-MM-DD). Times come back in circuit-local time. */
export async function fetchForecast(lat: number, lon: number, startDate: string, endDate: string): Promise<{ hours: ForecastHour[]; offsetSeconds: number }> {
  const url =
    `${FORECAST}?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,wind_speed_10m,weather_code` +
    `&timezone=auto&start_date=${startDate}&end_date=${endDate}`;
  const r = await cached<RawForecast>(url, HOUR);
  const h = r.hourly;
  return {
    offsetSeconds: r.utc_offset_seconds,
    hours: h.time.map((t, i) => ({
      time: t,
      tempC: h.temperature_2m[i],
      rainChance: h.precipitation_probability[i] ?? 0,
      windKmh: h.wind_speed_10m[i] ?? 0,
      code: h.weather_code[i] ?? 0,
    })),
  };
}

export interface ForecastSummary {
  tempMin: number;
  tempMax: number;
  rainChance: number;
  windMax: number;
  label: string;
}

/** WMO weather code -> a plain word (no icons needed; text is always shown). */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Mostly clear';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Mixed';
}

/** The forecast hours that cover a session (inclusive of the hour it starts in), in circuit-local time. */
export function summariseForecast(hours: ForecastHour[], s: Pick<RaceSession, 'startUtc' | 'endUtc'>, offset: number): ForecastSummary | null {
  const local = (utc: string) => new Date(Date.parse(utc) + offset * 1000).toISOString().slice(0, 13);
  const from = local(s.startUtc);
  const to = local(s.endUtc);
  const within = hours.filter((h) => h.time.slice(0, 13) >= from && h.time.slice(0, 13) <= to);
  if (!within.length) return null;
  const worst = within.reduce((a, b) => (b.code > a.code ? b : a));
  return {
    tempMin: Math.min(...within.map((h) => h.tempC)),
    tempMax: Math.max(...within.map((h) => h.tempC)),
    rainChance: Math.max(...within.map((h) => h.rainChance)),
    windMax: Math.max(...within.map((h) => h.windKmh)),
    label: weatherLabel(worst.code),
  };
}

/* ---------- results with driver faces ---------- */

export interface ResultRow {
  position: number | null;
  number: number;
  code: string;
  name: string;
  team: string;
  /** Team colour as "#rrggbb". */
  colour: string;
  headshotUrl: string | null;
  points: number;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  laps: number | null;
  /** Race time, best lap or qualifying best, whichever fits the session. */
  time: number | null;
  gap: string;
}
type RawDriver = { driver_number: number; name_acronym: string; full_name: string; team_name: string; team_colour: string; headshot_url: string | null };
type RawResult = {
  position: number | null;
  driver_number: number;
  number_of_laps: number | null;
  points: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  duration: number | (number | null)[] | null;
  gap_to_leader: number | string | (number | string | null)[] | null;
};

const lastOf = <T,>(v: T | (T | null)[] | null): T | null => (Array.isArray(v) ? ([...v].reverse().find((x) => x != null) ?? null) : v);

export function titleCaseName(full: string): string {
  return full
    .toLowerCase()
    .replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
}

export function formatLapTime(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return '';
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  const whole = Math.floor(s);
  const ms = Math.round((s - whole) * 1000);
  const mmm = String(ms === 1000 ? 999 : ms).padStart(3, '0');
  return m > 0 ? `${m}:${String(whole).padStart(2, '0')}.${mmm}` : `${whole}.${mmm}`;
}

export function formatGap(g: number | string | null): string {
  if (g == null) return '';
  if (typeof g === 'string') return g;
  return g === 0 ? '' : `+${g.toFixed(3)}`;
}

/** Finishing order with faces: drivers joined to the session result on driver number. Classified drivers
 * first by position, then retirements by laps completed (most first). */
export async function fetchResults(sessionKey: number): Promise<ResultRow[]> {
  const [drivers, results] = await Promise.all([
    cached<RawDriver[]>(`${BASE}/drivers?session_key=${sessionKey}`, 24 * HOUR),
    cached<RawResult[]>(`${BASE}/session_result?session_key=${sessionKey}`, 24 * HOUR),
  ]);
  const byNum = new Map(drivers.map((d) => [d.driver_number, d]));
  const rows: ResultRow[] = results.map((r) => {
    const d = byNum.get(r.driver_number);
    return {
      position: r.position,
      number: r.driver_number,
      code: d?.name_acronym ?? String(r.driver_number),
      name: d ? titleCaseName(d.full_name) : `#${r.driver_number}`,
      team: d?.team_name ?? '',
      colour: d?.team_colour ? `#${d.team_colour}` : '#888888',
      headshotUrl: d?.headshot_url ?? null,
      points: r.points ?? 0,
      dnf: r.dnf,
      dns: r.dns,
      dsq: r.dsq,
      laps: r.number_of_laps,
      time: lastOf(r.duration) as number | null,
      gap: formatGap(lastOf(r.gap_to_leader) as number | string | null),
    };
  });
  return rows.sort((a, b) => {
    if (a.position != null && b.position != null) return a.position - b.position;
    if (a.position != null) return -1;
    if (b.position != null) return 1;
    return (b.laps ?? 0) - (a.laps ?? 0);
  });
}

export interface TeamRow {
  team: string;
  colour: string;
  points: number;
  /** Best finishing position of the team's drivers, when no points were awarded (practice/qualifying). */
  bestPosition: number | null;
  drivers: string[];
}

/** Team standings for ONE session: points summed for race/sprint, otherwise ranked by best driver. */
export function teamStandings(rows: ResultRow[]): TeamRow[] {
  const map = new Map<string, TeamRow>();
  for (const r of rows) {
    if (!r.team) continue;
    const t = map.get(r.team) ?? { team: r.team, colour: r.colour, points: 0, bestPosition: null, drivers: [] };
    t.points += r.points;
    t.drivers.push(r.code);
    if (r.position != null && (t.bestPosition == null || r.position < t.bestPosition)) t.bestPosition = r.position;
    map.set(r.team, t);
  }
  const list = [...map.values()];
  const anyPoints = list.some((t) => t.points > 0);
  return list.sort((a, b) =>
    anyPoints ? b.points - a.points : (a.bestPosition ?? 99) - (b.bestPosition ?? 99),
  );
}

/* ---------- tyres actually used ---------- */

export interface TyreUse {
  compound: string;
  laps: number;
  stints: number;
}
type RawStint = { compound: string | null; lap_start: number; lap_end: number };

export async function fetchTyreUse(sessionKey: number): Promise<TyreUse[]> {
  const rows = await cached<RawStint[]>(`${BASE}/stints?session_key=${sessionKey}`, 24 * HOUR);
  const map = new Map<string, TyreUse>();
  for (const s of rows) {
    if (!s.compound) continue;
    const t = map.get(s.compound) ?? { compound: s.compound, laps: 0, stints: 0 };
    t.laps += Math.max(0, s.lap_end - s.lap_start + 1);
    t.stints += 1;
    map.set(s.compound, t);
  }
  return [...map.values()].sort((a, b) => b.laps - a.laps);
}
