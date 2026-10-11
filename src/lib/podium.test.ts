import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPodiumCache, fetchPodiumForRace, formatRaceTime, parsePodium, RACE_POINTS } from './podium';

const drivers = [
  { driver_number: 1, full_name: 'Max VERSTAPPEN', name_acronym: 'VER', team_name: 'Red Bull Racing', team_colour: '3671C6', headshot_url: 'https://media.example/ver.png' },
  { driver_number: 4, full_name: 'Lando NORRIS', name_acronym: 'NOR', team_name: 'McLaren', team_colour: 'FF8000', headshot_url: null },
  { driver_number: 16, full_name: 'Charles LECLERC', name_acronym: 'LEC', team_name: 'Ferrari', team_colour: 'not-a-colour', headshot_url: 'http://insecure.example/lec.png' },
  { driver_number: 44, full_name: 'Lewis HAMILTON', name_acronym: 'HAM', team_name: 'Ferrari', team_colour: 'E8002D', headshot_url: null },
];
const results = [
  { driver_number: 44, position: 4, duration: 5600.1, gap_to_leader: 20.5 },
  { driver_number: 16, position: 3, duration: 5590.2, gap_to_leader: 10.25 },
  { driver_number: 1, position: 1, duration: 5579.952, gap_to_leader: 0 },
  { driver_number: 4, position: 2, duration: [null, 5581.1], gap_to_leader: [null, 1.148] },
];

describe('parsePodium', () => {
  it('joins results with drivers and keeps P1-P3 in order', () => {
    const p = parsePodium(results, drivers)!;
    expect(p.map((d) => d.code)).toEqual(['VER', 'NOR', 'LEC']);
    expect(p.map((d) => d.position)).toEqual([1, 2, 3]);
    expect(p[0]).toMatchObject({
      name: 'Max Verstappen',
      team: 'Red Bull Racing',
      colour: '#3671C6',
      headshotUrl: 'https://media.example/ver.png',
      points: RACE_POINTS[1],
      detail: '1:32:59.952',
    });
    // qualifying-style arrays: the last value wins
    expect(p[1].detail).toBe('+1.148');
    expect(p[1].headshotUrl).toBeNull();
  });
  it('sanitises colours and image URLs', () => {
    const p = parsePodium(results, drivers)!;
    expect(p[2].colour).toBe('#9aa6bd');
    expect(p[2].headshotUrl).toBeNull();
  });
  it('uses standard race points 25/18/15', () => {
    expect(parsePodium(results, drivers)!.map((d) => d.points)).toEqual([25, 18, 15]);
  });
  it('returns null when a podium place is missing, disqualified or unknown', () => {
    expect(parsePodium(results.filter((r) => r.position !== 2), drivers)).toBeNull();
    expect(parsePodium(results.map((r) => (r.position === 3 ? { ...r, dsq: true } : r)), drivers)).toBeNull();
    expect(parsePodium(results, drivers.filter((d) => d.driver_number !== 1))).toBeNull();
    expect(parsePodium([], drivers)).toBeNull();
    expect(parsePodium(null, drivers)).toBeNull();
    expect(parsePodium(results, { nope: true })).toBeNull();
  });
  it('formatRaceTime', () => {
    expect(formatRaceTime(5579.952)).toBe('1:32:59.952');
    expect(formatRaceTime(61.5)).toBe('0:01:01.500');
  });
});

describe('fetchPodiumForRace', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearPodiumCache();
  });
  const race = { id: '2026-r17-singapore', season: 2026, country: 'Singapore', locality: 'Singapore', raceDate: '2026-10-11' };

  it('finds the race session, fetches both datasets once and caches the result', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.includes('/sessions?')
        ? [{ session_key: 999, session_type: 'Race', date_start: '2026-10-11T12:00:00Z', country_name: 'Singapore', location: 'Marina Bay' }]
        : url.includes('/session_result?')
          ? results
          : drivers;
      return { ok: true, status: 200, json: async () => body };
    });
    vi.stubGlobal('fetch', fetchMock);
    const a = await fetchPodiumForRace(race);
    const b = await fetchPodiumForRace(race);
    expect(a?.map((d) => d.code)).toEqual(['VER', 'NOR', 'LEC']);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('session_key=999'))).toBe(true);
  });

  it('fails silently (null) on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500, json: async () => [] })));
    expect(await fetchPodiumForRace(race)).toBeNull();
  });
});
