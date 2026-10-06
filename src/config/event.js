import { Timestamp } from 'firebase/firestore';
import { fetchSchedule, raceStartFor } from '../lib/f1api';
import { fetchLineupForRace } from '../lib/openf1';
export const LIGHTS_OUT_UTC = '2026-09-26T11:00:00Z';
export const WHATSAPP_COMMUNITY_URL = '';
export const SITE_TITLE = 'Kartar CUP';
export const EVENT_NAME = 'Race Watch Party';
export const EVENT_SUBTITLE = 'The Karter Cup watch party';
export const TEAMS = [
    { id: 'mercedes', label: 'Mercedes' },
    { id: 'ferrari', label: 'Ferrari' },
    { id: 'mclaren', label: 'McLaren' },
    { id: 'red-bull', label: 'Red Bull' },
    { id: 'alpine', label: 'Alpine' },
    { id: 'haas', label: 'Haas' },
    { id: 'racing-bulls', label: 'Racing Bulls' },
    { id: 'williams', label: 'Williams' },
    { id: 'audi', label: 'Audi' },
    { id: 'cadillac', label: 'Cadillac' },
    { id: 'aston-martin', label: 'Aston Martin' },
];
export const DRIVERS = [
    { id: 'russell', label: 'Russell', sub: 'Mercedes · P1' },
    { id: 'leclerc', label: 'Leclerc', sub: 'Ferrari · P2' },
    { id: 'piastri', label: 'Piastri', sub: 'McLaren · P3' },
    { id: 'hadjar', label: 'Hadjar', sub: 'Red Bull · P4' },
    { id: 'norris', label: 'Norris', sub: 'McLaren · P5' },
    { id: 'hamilton', label: 'Hamilton', sub: 'Ferrari · P6' },
    { id: 'gasly', label: 'Gasly', sub: 'Alpine · P7' },
    { id: 'verstappen', label: 'Verstappen', sub: 'Red Bull · P8' },
    { id: 'colapinto', label: 'Colapinto', sub: 'Alpine · P9' },
    { id: 'bearman', label: 'Bearman', sub: 'Haas · P10' },
    { id: 'lawson', label: 'Lawson', sub: 'Racing Bulls · P11' },
    { id: 'albon', label: 'Albon', sub: 'Williams · P12' },
    { id: 'ocon', label: 'Ocon', sub: 'Haas · P13' },
    { id: 'sainz', label: 'Sainz', sub: 'Williams · P14' },
    { id: 'lindblad', label: 'Lindblad', sub: 'Racing Bulls · P15' },
    { id: 'antonelli', label: 'Antonelli', sub: 'Mercedes · P16' },
    { id: 'bortoleto', label: 'Bortoleto', sub: 'Audi · P17' },
    { id: 'hulkenberg', label: 'Hulkenberg', sub: 'Audi · P18' },
    { id: 'perez', label: 'Perez', sub: 'Cadillac · P19' },
    { id: 'bottas', label: 'Bottas', sub: 'Cadillac · P20' },
    { id: 'alonso', label: 'Alonso', sub: 'Aston Martin · P21' },
    { id: 'stroll', label: 'Stroll', sub: 'Aston Martin · P22' },
];
export const QUESTIONS = [
    { id: 'q1', kind: 'team', prompt: 'Which constructor has the SLOWEST pit stop?',
        hint: 'Box, box... and then a long, awkward silence on the radio.' },
    { id: 'q2', kind: 'driver', prompt: 'Which driver makes the MOST overtakes?',
        hint: 'Copy, we are going for the gap. Do not lift.' },
    { id: 'q3', kind: 'driver', prompt: 'Which driver will DNF?',
        hint: 'Stop the car, stop the car. Check the barriers.' },
    { id: 'q4', kind: 'team', prompt: 'Which constructor has the FASTEST pit stop?',
        hint: 'Gun crew is ready. Two seconds or we talk about it.' },
    { id: 'q5', kind: 'driver', prompt: 'Which driver sets the FASTEST LAP?',
        hint: 'Purple sector, purple sector. Send it, no mercy.' },
];
export const DEFAULT_RACE_DURATION_MIN = 90;
// RaceInfo carries a date only; hosts adjust the start time on the settings page.
export const DEFAULT_RACE_START_UTC_TIME = '13:00:00';
/** Static fallback grid: today's hand-written 2026-era template, used when OpenF1 has no data. */
function staticGrid() {
    return {
        teams: TEAMS.map((t) => ({ id: t.id, label: t.label })),
        drivers: DRIVERS.map((d, i) => {
            const teamLabel = (d.sub ?? '').split(' · ')[0];
            return { id: d.id, label: d.label, teamId: TEAMS.find((t) => t.label === teamLabel)?.id ?? '', grid: i + 1 };
        }),
    };
}
/**
 * Fetches the real driver/team lineup for a race from OpenF1 (R30). Falls back to the
 * static template grid — labeled 'provisional' by the caller — when OpenF1 has no data yet
 * (expected for races that have not been run) or the fetch fails.
 */
export async function fetchLiveGrid(race) {
    if (race.id === 'custom')
        return { ...staticGrid(), gridStatus: { kind: 'no-data' } };
    const lineup = await fetchLineupForRace(race.season, race);
    if (lineup.ok) {
        return {
            teams: lineup.teams.map((t) => ({ id: t.id, label: t.label })),
            drivers: lineup.drivers,
            gridStatus: { kind: 'fetched', fetchedAtMs: Date.now() },
        };
    }
    const gridStatus = lineup.reason.includes('no entry list') || lineup.reason.includes('no OpenF1 session')
        ? { kind: 'no-data' }
        : { kind: 'error', reason: lineup.reason };
    return { ...staticGrid(), gridStatus };
}
export async function buildDefaultEvent(race, durationMin = DEFAULT_RACE_DURATION_MIN) {
    // Real lights-out from the official schedule when available (race times differ by circuit);
    // the flat default only when the API has nothing for this round.
    const schedule = await fetchSchedule(race.season);
    const startMs = raceStartFor(race, schedule).ms;
    const closesMs = startMs + Math.round(0.9 * durationMin * 60_000);
    const now = Timestamp.now();
    const { teams, drivers, gridStatus } = await fetchLiveGrid(race);
    return {
        config: {
            id: race.id,
            raceId: race.id,
            name: race.name,
            subtitle: EVENT_SUBTITLE,
            circuit: race.circuit,
            themeId: race.themeId,
            raceStartUtc: Timestamp.fromMillis(startMs),
            raceDurationMin: durationMin,
            opensAt: Timestamp.fromMillis(startMs),
            closesAt: Timestamp.fromMillis(closesMs),
            override: 'none',
            whatsappUrl: WHATSAPP_COMMUNITY_URL,
            teams,
            drivers,
            questions: QUESTIONS.map((q) => ({ ...q })),
            questionIds: QUESTIONS.map((q) => q.id),
            winnerRevealed: false,
            tiebreakOverride: null,
            createdAt: now,
            updatedAt: now,
        },
        gridStatus,
    };
}
export function optionsFor(q) {
    return q.kind === 'team' ? TEAMS : DRIVERS;
}
export function validateEventConfig() {
    const errs = [];
    if (QUESTIONS.length !== 5)
        errs.push('expected 5 questions');
    if (new Set(QUESTIONS.map((q) => q.id)).size !== QUESTIONS.length)
        errs.push('duplicate question ids');
    if (TEAMS.length !== 11)
        errs.push('expected 11 teams');
    if (DRIVERS.length !== 22)
        errs.push('expected 22 drivers');
    if (new Set(TEAMS.map((t) => t.id)).size !== TEAMS.length)
        errs.push('duplicate team ids');
    if (new Set(DRIVERS.map((d) => d.id)).size !== DRIVERS.length)
        errs.push('duplicate driver ids');
    for (const d of DRIVERS) {
        const team = (d.sub ?? '').split(' · ')[0];
        if (!TEAMS.some((t) => t.label === team))
            errs.push(`driver ${d.id}: team not in TEAMS`);
    }
    if (Number.isNaN(Date.parse(LIGHTS_OUT_UTC)))
        errs.push('LIGHTS_OUT_UTC does not parse');
    return errs;
}
