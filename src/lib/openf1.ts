/**
 * OpenF1 (https://api.openf1.org/v1/) client: fetches the real driver/team lineup for a
 * race weekend. Public API, no auth key, CORS-open (verified: access-control-allow-origin: *).
 *
 * OpenF1 has reliable data for 2023+ sessions that have actually happened. A session far in
 * the future (not yet run) commonly has no /drivers rows yet - that is expected, not a bug.
 * Every exported async function returns a typed result and never throws.
 */

export const BASE = 'https://api.openf1.org/v1';

interface OpenF1Session {
  session_key: number;
  session_type: string;
  date_start: string;
  country_name?: string;
  location?: string;
}

export interface OpenF1Driver {
  driver_number: number;
  full_name: string;
  team_name: string;
  team_colour?: string;
}

export interface DriverEntry {
  id: string;
  label: string;
  teamId: string;
  grid: number;
}

export interface TeamEntry {
  id: string;
  label: string;
  colour?: string;
}

export type LineupResult =
  | { ok: true; drivers: DriverEntry[]; teams: TeamEntry[]; sessionKey: number }
  | { ok: false; reason: string };

export type SessionLookupResult = { ok: true; sessionKey: number } | { ok: false; reason: string };

/** slugify a label into a stable-ish id, e.g. "Max Verstappen" -> "max-verstappen" */
export function slug(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenF1 request failed: ${res.status}`);
  return res.json();
}

/**
 * Finds the Race session_key for a given year + race, by fetching every Race session for
 * that year and picking the closest match on country/location and race date.
 */
export async function findSessionKey(
  year: number,
  race: { country: string; locality: string; raceDate: string },
): Promise<SessionLookupResult> {
  let raw: unknown;
  try {
    raw = await getJson(`${BASE}/sessions?session_type=Race&year=${year}`);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'network error' };
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: `no ${year} race sessions in OpenF1 yet` };
  }
  const sessions = raw as OpenF1Session[];
  const country = race.country.toLowerCase();
  const locality = race.locality.toLowerCase();
  const targetMs = Date.parse(`${race.raceDate}T00:00:00Z`);

  const scored = sessions
    .filter((s) => typeof s.session_key === 'number' && s.date_start)
    .map((s) => {
      const name = `${s.country_name ?? ''} ${s.location ?? ''}`.toLowerCase();
      const nameMatch = name.includes(country) || name.includes(locality) ? 0 : 1;
      const dayDiff = Number.isNaN(targetMs) ? 0 : Math.abs(Date.parse(s.date_start) - targetMs);
      return { session: s, nameMatch, dayDiff };
    })
    .sort((a, b) => a.nameMatch - b.nameMatch || a.dayDiff - b.dayDiff);

  const best = scored[0];
  if (!best || best.nameMatch === 1) {
    return { ok: false, reason: `no OpenF1 session matched ${race.locality}/${race.country} in ${year}` };
  }
  return { ok: true, sessionKey: best.session.session_key };
}

/** Pure normalization: raw OpenF1 driver rows -> our {drivers, teams} shape. Exported for tests. */
export function normalizeDrivers(rows: OpenF1Driver[]): { drivers: DriverEntry[]; teams: TeamEntry[] } {
  const teamsByName = new Map<string, TeamEntry>();
  for (const r of rows) {
    if (!r.team_name) continue;
    const id = slug(r.team_name);
    if (!teamsByName.has(id)) teamsByName.set(id, { id, label: r.team_name, colour: r.team_colour });
  }
  const teams = [...teamsByName.values()];
  const drivers = rows
    .filter((r) => r.full_name)
    .sort((a, b) => a.driver_number - b.driver_number)
    .map((r, i) => ({
      id: slug(r.full_name),
      label: r.full_name,
      teamId: slug(r.team_name ?? ''),
      grid: i + 1,
    }));
  return { drivers, teams };
}

/** Fetches and normalizes the driver/team lineup for an already-known session_key. */
export async function fetchDrivers(sessionKey: number): Promise<LineupResult> {
  let raw: unknown;
  try {
    raw = await getJson(`${BASE}/drivers?session_key=${sessionKey}`);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : 'network error' };
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, reason: 'no entry list yet for this session' };
  }
  const { drivers, teams } = normalizeDrivers(raw as OpenF1Driver[]);
  if (drivers.length === 0 || teams.length === 0) {
    return { ok: false, reason: 'no entry list yet for this session' };
  }
  return { ok: true, drivers, teams, sessionKey };
}

/** Convenience: find the session then fetch its lineup, for a given race. */
export async function fetchLineupForRace(
  year: number,
  race: { country: string; locality: string; raceDate: string },
): Promise<LineupResult> {
  const session = await findSessionKey(year, race);
  if (!session.ok) return session;
  return fetchDrivers(session.sessionKey);
}
