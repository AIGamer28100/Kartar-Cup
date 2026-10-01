/**
 * OpenF1 -> quiz answers. Pulls the facts the quiz scores on (slowest/fastest pit stop team, most
 * overtakes, DNF, fastest lap) from a finished race session, then maps them onto an event's own
 * questions. This only PREFILLS the host's results draft; the host reviews and saves (results decide
 * prizes, so nothing here writes to Firestore).
 */
import { BASE, findSessionKey, slug, type OpenF1Driver } from './openf1';
import type { QuestionCfg } from './types';

interface SessionResultRow {
  driver_number: number;
  dnf?: boolean;
}
interface PitRow {
  driver_number: number;
  stop_duration?: number | null;
  lane_duration?: number | null;
  pit_duration?: number | null;
}
interface OvertakeRow {
  overtaking_driver_number: number;
}
interface LapRow {
  driver_number: number;
  lap_duration?: number | null;
}

export interface RawRaceData {
  drivers: OpenF1Driver[];
  sessionResult: SessionResultRow[];
  pits: PitRow[];
  overtakes: OvertakeRow[];
  laps: LapRow[];
  /** Datasets that errored (e.g. rate limited) rather than came back empty. */
  failed?: string[];
}

export interface RaceFacts {
  slowestPitTeams: string[];
  fastestPitTeams: string[];
  mostOvertakeDrivers: string[];
  dnfDrivers: string[];
  fastestLapDrivers: string[];
  /** Plain-language caveats for the host (ties, missing data, voided questions). */
  notes: string[];
}

const nameOf = (d: OpenF1Driver) => slug(d.full_name);
const teamOf = (d: OpenF1Driver) => slug(d.team_name ?? '');

function extremes<K>(scores: Map<K, number>, pick: 'min' | 'max'): K[] {
  if (scores.size === 0) return [];
  const vals = [...scores.values()];
  const best = pick === 'min' ? Math.min(...vals) : Math.max(...vals);
  return [...scores].filter(([, v]) => v === best).map(([k]) => k);
}

/** Pure: raw OpenF1 rows -> the five race facts. Ties keep every tied id (all are accepted answers). */
export function deriveRaceFacts(raw: RawRaceData): RaceFacts {
  const notes: string[] = [];
  const failed = new Set(raw.failed ?? []);
  const absent = (dataset: string, what: string) =>
    failed.has(dataset)
      ? `Couldn't load ${what} from OpenF1 (it may be busy) - press Pull again in a minute.`
      : `OpenF1 has no ${what} for this race.`;
  const byNumber = new Map(raw.drivers.map((d) => [d.driver_number, d]));

  // Pit stops: per-team slowest/fastest single stop. Prefer stationary time; fall back to lane time
  // only if no stop has a stationary reading, so the two measures are never mixed.
  const haveStop = raw.pits.some((p) => typeof p.stop_duration === 'number');
  const pitTime = (p: PitRow) =>
    haveStop ? p.stop_duration : (p.lane_duration ?? p.pit_duration);
  if (raw.pits.length > 0 && !haveStop) notes.push('Pit times are pit-lane time (no stationary times in OpenF1 for this race).');
  const slowestByTeam = new Map<string, number>();
  const fastestByTeam = new Map<string, number>();
  for (const p of raw.pits) {
    const t = pitTime(p);
    const team = byNumber.get(p.driver_number);
    if (typeof t !== 'number' || !team?.team_name) continue;
    const id = teamOf(team);
    slowestByTeam.set(id, Math.max(slowestByTeam.get(id) ?? -Infinity, t));
    fastestByTeam.set(id, Math.min(fastestByTeam.get(id) ?? Infinity, t));
  }
  const slowestPitTeams = extremes(slowestByTeam, 'max');
  const fastestPitTeams = extremes(fastestByTeam, 'min');
  if (raw.pits.length === 0) notes.push(absent('pit', 'pit stop data'));

  // Overtakes: count per overtaking driver.
  const overtakeCount = new Map<string, number>();
  for (const o of raw.overtakes) {
    const d = byNumber.get(o.overtaking_driver_number);
    if (!d) continue;
    overtakeCount.set(nameOf(d), (overtakeCount.get(nameOf(d)) ?? 0) + 1);
  }
  const mostOvertakeDrivers = extremes(overtakeCount, 'max');
  if (raw.overtakes.length === 0) notes.push(absent('overtakes', 'overtake data'));

  // DNF: any driver flagged dnf in the official classification.
  const dnfDrivers = raw.sessionResult
    .filter((r) => r.dnf)
    .map((r) => byNumber.get(r.driver_number))
    .filter((d): d is OpenF1Driver => !!d)
    .map(nameOf);
  if (raw.sessionResult.length === 0) notes.push(absent('session_result', 'classification'));
  else if (dnfDrivers.length === 0) notes.push('Nobody retired, so the DNF question will be left voided.');

  // Fastest lap: single quickest lap across every driver.
  const bestLap = new Map<string, number>();
  for (const l of raw.laps) {
    const d = byNumber.get(l.driver_number);
    if (!d || typeof l.lap_duration !== 'number') continue;
    bestLap.set(nameOf(d), Math.min(bestLap.get(nameOf(d)) ?? Infinity, l.lap_duration));
  }
  const fastestLapDrivers = extremes(bestLap, 'min');
  if (raw.laps.length === 0) notes.push(absent('laps', 'lap data'));

  for (const [label, ids] of [
    ['slowest pit stop', slowestPitTeams],
    ['fastest pit stop', fastestPitTeams],
    ['most overtakes', mostOvertakeDrivers],
    ['fastest lap', fastestLapDrivers],
  ] as const) {
    if (ids.length > 1) notes.push(`Tie for ${label}: all ${ids.length} are accepted.`);
  }

  return { slowestPitTeams, fastestPitTeams, mostOvertakeDrivers, dnfDrivers, fastestLapDrivers, notes };
}

type FactKey = keyof Omit<RaceFacts, 'notes'>;

/** Which fact a question asks for, judged from its prompt (hosts can edit prompts). Order matters:
 * "fastest pit" must be tested before "fastest lap". */
export function factForPrompt(prompt: string): FactKey | null {
  const p = prompt.toLowerCase();
  if (/slowest.*pit|pit.*slowest/.test(p)) return 'slowestPitTeams';
  if (/fastest.*pit|pit.*fastest/.test(p)) return 'fastestPitTeams';
  if (/overtake/.test(p)) return 'mostOvertakeDrivers';
  if (/dnf|retire|did not finish/.test(p)) return 'dnfDrivers';
  if (/fastest.*lap/.test(p)) return 'fastestLapDrivers';
  return null;
}

export interface MappedAnswers {
  /** Only questions we could answer; others are absent so the host's existing draft is kept. */
  answers: Record<string, string[]>;
  filled: string[];
  skipped: string[];
}

/** Maps facts onto an event's questions, keeping only ids that exist in that event's lineup. */
export function mapFactsToQuestions(
  facts: RaceFacts,
  questions: QuestionCfg[],
  validIds: { team: Set<string>; driver: Set<string> },
): MappedAnswers {
  const answers: Record<string, string[]> = {};
  const filled: string[] = [];
  const skipped: string[] = [];
  for (const q of questions) {
    const key = factForPrompt(q.prompt);
    if (!key) {
      skipped.push(`"${q.prompt}" - no matching OpenF1 data, fill in by hand.`);
      continue;
    }
    const valid = q.kind === 'team' ? validIds.team : validIds.driver;
    const ids = facts[key].filter((id) => valid.has(id));
    if (ids.length < facts[key].length) {
      skipped.push(`"${q.prompt}" - OpenF1's answer isn't in this event's lineup, check it by hand.`);
      if (ids.length === 0 && facts[key].length > 0) continue;
    }
    answers[q.id] = ids;
    filled.push(q.prompt);
  }
  return { answers, filled, skipped };
}

export type FactsResult = { ok: true; facts: RaceFacts; sessionKey: number } | { ok: false; reason: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One dataset. OpenF1 rate-limits bursts (HTTP 429), so retry with backoff and report a real
 * failure separately from a genuinely empty dataset. */
async function list<T>(path: string, sessionKey: number): Promise<{ rows: T[]; failed: boolean }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}?session_key=${sessionKey}`);
      if (res.status === 429) {
        await sleep(900 * (attempt + 1));
        continue;
      }
      if (!res.ok) return { rows: [], failed: true };
      const raw: unknown = await res.json();
      return { rows: Array.isArray(raw) ? (raw as T[]) : [], failed: false };
    } catch {
      await sleep(500 * (attempt + 1));
    }
  }
  return { rows: [], failed: true };
}

/** Fetch every dataset for a known session (one at a time, paced) and derive the facts. Never throws. */
export async function fetchRaceFacts(sessionKey: number): Promise<FactsResult> {
  const failed: string[] = [];
  const get = async <T>(path: string): Promise<T[]> => {
    const { rows, failed: bad } = await list<T>(path, sessionKey);
    if (bad) failed.push(path);
    await sleep(350);
    return rows;
  };
  const drivers = await get<OpenF1Driver>('drivers');
  const sessionResult = await get<SessionResultRow>('session_result');
  const pits = await get<PitRow>('pit');
  const overtakes = await get<OvertakeRow>('overtakes');
  const laps = await get<LapRow>('laps');
  if (failed.includes('drivers') || drivers.length === 0) {
    return {
      ok: false,
      reason: failed.includes('drivers')
        ? 'Could not reach OpenF1 (it may be busy) - try again in a minute.'
        : 'OpenF1 has no results for this race yet - try again after the race.',
    };
  }
  if (sessionResult.length === 0 && laps.length === 0 && failed.length === 0) {
    return { ok: false, reason: 'OpenF1 has no results for this race yet - try again after the race.' };
  }
  return { ok: true, facts: deriveRaceFacts({ drivers, sessionResult, pits, overtakes, laps, failed }), sessionKey };
}

export async function fetchRaceFactsForRace(
  year: number,
  race: { country: string; locality: string; raceDate: string },
): Promise<FactsResult> {
  const session = await findSessionKey(year, race);
  if (!session.ok) return { ok: false, reason: session.reason };
  return fetchRaceFacts(session.sessionKey);
}
