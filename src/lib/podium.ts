/**
 * Race podium (P1-P3) from OpenF1 for the home page's chequered-flag / completed race state.
 * Pure parser (parsePodium, unit-tested with fixture rows) + a thin, cached fetch. Never throws and
 * never invents data: any failure or incomplete data returns null and the podium simply does not show.
 */
import type { PodiumDriver } from '../components/RaceStateDisplay';
import { BASE, findSessionKey, getJson } from './openf1';
import { formatGap, titleCaseName } from './raceData';

interface RawResultRow {
  driver_number?: unknown;
  position?: unknown;
  duration?: unknown;
  gap_to_leader?: unknown;
  dnf?: unknown;
  dns?: unknown;
  dsq?: unknown;
}
interface RawDriverRow {
  driver_number?: unknown;
  full_name?: unknown;
  name_acronym?: unknown;
  team_name?: unknown;
  team_colour?: unknown;
  headshot_url?: unknown;
}

/** Standard Grand Prix points for P1-P3 (shown labelled as race points). */
export const RACE_POINTS: Record<1 | 2 | 3, number> = { 1: 25, 2: 18, 3: 15 };

const lastNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (Array.isArray(v)) {
    for (let i = v.length - 1; i >= 0; i--) if (typeof v[i] === 'number' && Number.isFinite(v[i])) return v[i];
  }
  return null;
};
const lastGap = (v: unknown): number | string | null => {
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (Array.isArray(v)) {
    for (let i = v.length - 1; i >= 0; i--) if (typeof v[i] === 'number' || typeof v[i] === 'string') return v[i];
  }
  return null;
};

/** Race time as h:mm:ss.sss. */
export function formatRaceTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec - h * 3600 - m * 60;
  return `${h}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

const HEX = /^[0-9a-f]{6}$/i;

/**
 * Join the Race session_result rows with the session's /drivers rows and keep exactly P1, P2 and P3.
 * Returns null unless all three classified positions are present with a known driver.
 */
export function parsePodium(results: unknown, drivers: unknown): PodiumDriver[] | null {
  if (!Array.isArray(results) || !Array.isArray(drivers)) return null;
  const byNum = new Map<number, RawDriverRow>();
  for (const d of drivers as RawDriverRow[]) if (typeof d?.driver_number === 'number') byNum.set(d.driver_number, d);
  const podium: PodiumDriver[] = [];
  for (const pos of [1, 2, 3] as const) {
    const r = (results as RawResultRow[]).find((x) => x?.position === pos && !x.dsq && !x.dns);
    if (!r || typeof r.driver_number !== 'number') return null;
    const d = byNum.get(r.driver_number);
    if (!d || typeof d.full_name !== 'string' || !d.full_name.trim()) return null;
    const colour = typeof d.team_colour === 'string' && HEX.test(d.team_colour.replace(/^#/, '')) ? `#${d.team_colour.replace(/^#/, '')}` : '#9aa6bd';
    const head = typeof d.headshot_url === 'string' && /^https:\/\//.test(d.headshot_url) ? d.headshot_url : null;
    const time = lastNum(r.duration);
    const gap = formatGap(lastGap(r.gap_to_leader));
    podium.push({
      position: pos,
      name: titleCaseName(d.full_name),
      code: typeof d.name_acronym === 'string' && d.name_acronym ? d.name_acronym : String(r.driver_number),
      team: typeof d.team_name === 'string' ? d.team_name : '',
      colour,
      headshotUrl: head,
      points: RACE_POINTS[pos],
      detail: pos === 1 ? (time != null ? formatRaceTime(time) : undefined) : gap || undefined,
    });
  }
  return podium;
}

const cache = new Map<string, Promise<PodiumDriver[] | null>>();

/** Podium for a finished race, fetched once per race per page load (in-memory cache). */
export function fetchPodiumForRace(race: { id: string; season: number; country: string; locality: string; raceDate: string }): Promise<PodiumDriver[] | null> {
  let p = cache.get(race.id);
  if (!p) {
    p = (async () => {
      try {
        const session = await findSessionKey(race.season, race);
        if (!session.ok) return null;
        const [results, drivers] = await Promise.all([
          getJson(`${BASE}/session_result?session_key=${session.sessionKey}`),
          getJson(`${BASE}/drivers?session_key=${session.sessionKey}`),
        ]);
        return parsePodium(results, drivers);
      } catch {
        return null;
      }
    })();
    cache.set(race.id, p);
  }
  return p;
}

/** Test hook: forget cached podiums. */
export function clearPodiumCache(): void {
  cache.clear();
}
