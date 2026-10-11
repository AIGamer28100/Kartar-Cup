import { describe, expect, it } from 'vitest';
import type { RaceSession, ResultRow } from '../../lib/raceData';
import {
  defaultSessionKey,
  fastestLapOf,
  formatRaceTime,
  isPodiumRow,
  openingSessionKey,
  isPointsSession,
  podiumFromRows,
  lapsDownText,
  normaliseGap,
  sessionKind,
  sessionTabs,
  shortSessionLabel,
  splitName,
  statusText,
  timeOrGap,
} from './resultsModel';

const row = (o: Partial<ResultRow>): ResultRow => ({
  position: 1,
  number: 1,
  code: 'VER',
  name: 'Max Verstappen',
  team: 'Red Bull Racing',
  colour: '#3671C6',
  headshotUrl: null,
  points: 0,
  dnf: false,
  dns: false,
  dsq: false,
  laps: 57,
  time: null,
  gap: '',
  ...o,
});

const HOUR = 3_600_000;
const sess = (key: number, name: string, startMs: number, o: Partial<RaceSession> = {}): RaceSession => ({
  key,
  name,
  type: name,
  startUtc: new Date(startMs).toISOString(),
  endUtc: new Date(startMs + HOUR).toISOString(),
  gmtOffset: '00:00:00',
  cancelled: false,
  ...o,
});

describe('session kinds and labels', () => {
  it('classifies OpenF1 session names', () => {
    expect(sessionKind('Practice 1')).toBe('practice');
    expect(sessionKind('Qualifying')).toBe('qualifying');
    expect(sessionKind('Sprint Qualifying')).toBe('qualifying');
    expect(sessionKind('Sprint Shootout')).toBe('qualifying');
    expect(sessionKind('Sprint')).toBe('sprint');
    expect(sessionKind('Race')).toBe('race');
  });
  it('awards points only in race and sprint', () => {
    expect(isPointsSession('Race')).toBe(true);
    expect(isPointsSession('Sprint')).toBe(true);
    expect(isPointsSession('Qualifying')).toBe(false);
    expect(isPointsSession('Practice 2')).toBe(false);
  });
  it('shortens tab labels for phones', () => {
    expect(shortSessionLabel('Practice 3')).toBe('FP3');
    expect(shortSessionLabel('Sprint Qualifying')).toBe('SQ');
    expect(shortSessionLabel('Qualifying')).toBe('Quali');
    expect(shortSessionLabel('Race')).toBe('Race');
  });
});

describe('statusText', () => {
  it('prefers DSQ over DNS over DNF', () => {
    expect(statusText(row({ dsq: true, dnf: true }))).toBe('DSQ');
    expect(statusText(row({ dns: true, dnf: true }))).toBe('DNS');
    expect(statusText(row({ dnf: true }))).toBe('DNF');
  });
  it('marks unclassified rows NC and normal finishes null', () => {
    expect(statusText(row({ position: null }))).toBe('NC');
    expect(statusText(row({}))).toBeNull();
  });
});

describe('gap formatting', () => {
  it('formats race time with hours', () => {
    expect(formatRaceTime(5525.123)).toBe('1:32:05.123');
    expect(formatRaceTime(null)).toBe('');
    expect(formatRaceTime(0)).toBe('');
  });
  it('writes laps down', () => {
    expect(lapsDownText(57, 56)).toBe('+1 Lap');
    expect(lapsDownText(57, 54)).toBe('+3 Laps');
    expect(lapsDownText(57, 57)).toBe('');
    expect(lapsDownText(null, 50)).toBe('');
  });
  it('normalises OpenF1 gaps', () => {
    expect(normaliseGap('+1 LAP')).toBe('+1 Lap');
    expect(normaliseGap('2 LAPS')).toBe('+2 Laps');
    expect(normaliseGap('+12.3')).toBe('+12.300');
    expect(normaliseGap('0')).toBe('');
    expect(normaliseGap('')).toBe('');
  });
  it('shows the leader time then +gap in a race', () => {
    const leader = row({ time: 5525.123 });
    expect(timeOrGap(leader, leader, 'race')).toBe('1:32:05.123');
    expect(timeOrGap(row({ number: 4, position: 2, gap: '+3.456' }), leader, 'race')).toBe('+3.456');
    expect(timeOrGap(row({ number: 16, position: 15, gap: '', laps: 56 }), leader, 'race')).toBe('+1 Lap');
    expect(timeOrGap(row({ number: 44, position: null, dnf: true }), leader, 'race')).toBe('DNF');
  });
  it('practice: leader best lap, others gap (computed when OpenF1 sends none)', () => {
    const leader = row({ time: 92.5 });
    expect(timeOrGap(leader, leader, 'practice')).toBe('1:32.500');
    expect(timeOrGap(row({ number: 4, position: 2, gap: '+0.2' }), leader, 'practice')).toBe('+0.200');
    expect(timeOrGap(row({ number: 81, position: 3, time: 92.75 }), leader, 'practice')).toBe('+0.250');
  });
  it('qualifying: each driver shows their own best lap', () => {
    const leader = row({ time: 90.1 });
    expect(timeOrGap(row({ number: 4, position: 2, time: 90.3, gap: '+0.2' }), leader, 'qualifying')).toBe('1:30.300');
  });
});

describe('splitName', () => {
  it('keeps multi-word given names together', () => {
    expect(splitName('Andrea Kimi Antonelli')).toEqual({ first: 'Andrea Kimi', last: 'Antonelli' });
    expect(splitName('Max Verstappen')).toEqual({ first: 'Max', last: 'Verstappen' });
    expect(splitName('Zhou')).toEqual({ first: '', last: 'Zhou' });
  });
});

describe('default session choice', () => {
  const now = Date.parse('2026-10-04T18:00:00Z');
  const fp1 = sess(1, 'Practice 1', now - 50 * HOUR);
  const quali = sess(2, 'Qualifying', now - 26 * HOUR);
  const race = sess(3, 'Race', now - 4 * HOUR);
  it('picks the latest completed session', () => {
    expect(defaultSessionKey([fp1, quali, race], now)).toBe(3);
  });
  it('skips sessions still inside the data blackout or upcoming', () => {
    const live = sess(3, 'Race', now - HOUR);
    expect(defaultSessionKey([fp1, quali, live], now)).toBe(2);
    expect(sessionTabs([live], now)[0].note).toBe('Live');
    expect(sessionTabs([sess(9, 'Race', now + 48 * HOUR)], now)[0]).toMatchObject({ available: false, note: 'Upcoming' });
  });
  it('skips cancelled sessions and returns null when nothing is done', () => {
    expect(defaultSessionKey([fp1, { ...quali, cancelled: true }], now)).toBe(1);
    expect(defaultSessionKey([sess(9, 'Race', now + 48 * HOUR)], now)).toBeNull();
    expect(defaultSessionKey([], now)).toBeNull();
  });
});

describe('fastestLapOf', () => {
  it('finds the quickest valid lap, earlier lap wins a tie', () => {
    expect(
      fastestLapOf([
        { driver_number: 1, lap_number: 10, lap_duration: 81.2 },
        { driver_number: 4, lap_number: 40, lap_duration: 80.9 },
        { driver_number: 16, lap_number: 30, lap_duration: 80.9 },
        { driver_number: 44, lap_number: 1, lap_duration: null },
      ]),
    ).toEqual({ driverNumber: 16, lapNumber: 30, seconds: 80.9 });
    expect(fastestLapOf([])).toBeNull();
  });
});

describe('podiumFromRows', () => {
  const race = [
    row({ position: 1, number: 1, code: 'VER', name: 'Max Verstappen', points: 25, time: 5400.5, laps: 56 }),
    row({ position: 2, number: 12, code: 'ANT', name: 'Kimi Antonelli', team: 'Mercedes', points: 18, gap: '2.307', laps: 56 }),
    row({ position: 3, number: 44, code: 'HAM', name: 'Lewis Hamilton', team: 'Ferrari', points: 15, gap: '4.919', laps: 56 }),
    row({ position: 4, number: 16, code: 'LEC', name: 'Charles Leclerc', points: 12, gap: '7.258', laps: 56 }),
  ];
  it('builds P1-P3 with the winner time and the gaps, and carries the points', () => {
    const p = podiumFromRows(race, 'race');
    expect(p?.map((d) => [d.position, d.code, d.points])).toEqual([[1, 'VER', 25], [2, 'ANT', 18], [3, 'HAM', 15]]);
    expect(p?.[0].detail).toBe('1:30:00.500');
    expect(p?.[1].detail).toBe('+2.307');
  });
  it('works for a sprint and for nothing else', () => {
    expect(podiumFromRows(race, 'sprint')).not.toBeNull();
    for (const k of ['practice', 'qualifying'] as const) expect(podiumFromRows(race, k)).toBeNull();
  });
  it('returns null unless all three places are classified finishers', () => {
    expect(podiumFromRows(race.slice(0, 2), 'race')).toBeNull();
    expect(podiumFromRows([race[0], race[1], row({ position: 3, number: 44, dsq: true })], 'race')).toBeNull();
    expect(podiumFromRows([race[0], race[1], row({ position: 3, number: 44, dnf: true })], 'race')).toBeNull();
  });
  it('isPodiumRow is true only for a classified P1-P3', () => {
    expect(isPodiumRow(race[0])).toBe(true);
    expect(isPodiumRow(race[3])).toBe(false);
    expect(isPodiumRow(row({ position: 2, dnf: true }))).toBe(false);
  });
});

describe('openingSessionKey', () => {
  const now = Date.UTC(2026, 9, 9, 12);
  const weekend = (offsetsH: number[], cancelled: number[] = []) =>
    ['Practice 1', 'Qualifying', 'Race'].map((n, i) => sess(i + 1, n, now + offsetsH[i] * HOUR, { cancelled: cancelled.includes(i + 1) }));
  it('opens on the race once it is finished', () => {
    expect(openingSessionKey(weekend([-72, -48, -24]), now)).toBe(3);
  });
  it('opens on the next session to run while the race is still ahead', () => {
    expect(openingSessionKey(weekend([-30, 20, 44]), now)).toBe(2);
    expect(openingSessionKey(weekend([20, 40, 60]), now)).toBe(1);
  });
  it('prefers the session running now', () => {
    expect(openingSessionKey(weekend([-30, -0.5, 24]), now)).toBe(2);
  });
  it('skips cancelled sessions, and falls back to the last session when nothing is left', () => {
    expect(openingSessionKey(weekend([-30, 20, 44], [2]), now)).toBe(3);
    expect(openingSessionKey(weekend([20, 40, 60], [1, 2, 3]), now)).toBe(3);
    expect(openingSessionKey([], now)).toBeNull();
  });
});
