/**
 * Jolpica (the maintained Ergast successor, https://api.jolpi.ca) client: the official season
 * schedule with every session time, and the championship standings. Public, no key, CORS-open.
 * Everything returned is real API data; on any failure callers get null and render nothing rather
 * than a guess (R17).
 */
const BASE = 'https://api.jolpi.ca/ergast/f1';
const FIELDS = [
    ['FirstPractice', 'fp1', 'Practice 1'],
    ['SecondPractice', 'fp2', 'Practice 2'],
    ['ThirdPractice', 'fp3', 'Practice 3'],
    ['SprintQualifying', 'sprintQuali', 'Sprint qualifying'],
    ['SprintShootout', 'sprintQuali', 'Sprint qualifying'],
    ['Sprint', 'sprint', 'Sprint'],
    ['Qualifying', 'quali', 'Qualifying'],
];
function toMs(s) {
    if (!s?.date)
        return null;
    const ms = Date.parse(`${s.date}T${s.time ?? '00:00:00Z'}`);
    return Number.isNaN(ms) ? null : ms;
}
/** Pure: Jolpica season JSON -> round number -> that weekend's sessions in running order. */
export function parseSchedule(json) {
    const out = new Map();
    const races = json?.MRData?.RaceTable?.Races ?? [];
    for (const r of races) {
        const sessions = [];
        for (const [field, key, label] of FIELDS) {
            const ms = toMs(r[field]);
            if (ms !== null)
                sessions.push({ key, label, startMs: ms });
        }
        const raceMs = toMs({ date: r.date, time: r.time });
        if (raceMs !== null)
            sessions.push({ key: 'race', label: 'Race', startMs: raceMs });
        sessions.sort((a, b) => a.startMs - b.startMs);
        const round = Number(r.round);
        if (Number.isInteger(round) && sessions.length > 0)
            out.set(round, sessions);
    }
    return out;
}
/** The race (lights-out) start for a round, if the schedule has it. */
export function raceStartMs(sessions) {
    return sessions?.find((s) => s.key === 'race')?.startMs ?? null;
}
/** Pure: the first session that has not started yet, or null when the weekend is over. */
export function nextSession(sessions, nowMs) {
    return sessions?.find((s) => s.startMs > nowMs) ?? null;
}
function parseStandings(json, list) {
    const lists = json?.MRData
        ?.StandingsTable?.StandingsLists;
    const first = lists?.[0];
    const rows = first?.[list];
    if (!first || !rows || rows.length === 0)
        return null;
    const parsed = rows.map((r, i) => ({
        position: Number(r.position ?? r.positionText) || i + 1,
        name: r.Driver ? `${r.Driver.givenName} ${r.Driver.familyName}` : (r.Constructor?.name ?? ''),
        team: r.Driver ? (r.Constructors?.[0]?.name ?? '') : '',
        points: Number(r.points) || 0,
        wins: Number(r.wins) || 0,
    }));
    return { round: Number(first.round) || 0, rows: parsed };
}
export const parseDriverStandings = (json) => parseStandings(json, 'DriverStandings');
export const parseConstructorStandings = (json) => parseStandings(json, 'ConstructorStandings');
const TTL_MS = 30 * 60_000;
/** GET with a short sessionStorage cache so a page revisit doesn't re-hit the (rate-limited) API. */
async function cachedJson(path) {
    const key = `jolpica:${path}`;
    try {
        const hit = sessionStorage.getItem(key);
        if (hit) {
            const { at, body } = JSON.parse(hit);
            if (Date.now() - at < TTL_MS)
                return body;
        }
    }
    catch {
        /* storage unavailable (private mode): just fetch */
    }
    try {
        const res = await fetch(`${BASE}${path}`);
        if (!res.ok)
            return null;
        const body = await res.json();
        try {
            sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), body }));
        }
        catch {
            /* ignore */
        }
        return body;
    }
    catch {
        return null;
    }
}
export async function fetchSchedule(season) {
    const json = await cachedJson(`/${season}.json?limit=40`);
    return json ? parseSchedule(json) : null;
}
export async function fetchDriverStandings(season) {
    const json = await cachedJson(`/${season}/driverstandings.json?limit=30`);
    return json ? parseDriverStandings(json) : null;
}
export async function fetchConstructorStandings(season) {
    const json = await cachedJson(`/${season}/constructorstandings.json?limit=15`);
    return json ? parseConstructorStandings(json) : null;
}
/** Fallback lights-out when the schedule has no time for a round (e.g. a season not published yet). */
export const FALLBACK_RACE_START_UTC = '13:00:00Z';
/** Real lights-out for a calendar race, or the dated fallback flagged as not exact. */
export function raceStartFor(race, schedule) {
    const real = raceStartMs(schedule?.get(race.round));
    if (real !== null)
        return { ms: real, exact: true };
    return { ms: Date.parse(`${race.raceDate}T${FALLBACK_RACE_START_UTC}`), exact: false };
}
