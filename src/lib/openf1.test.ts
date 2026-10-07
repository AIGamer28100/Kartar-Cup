import { describe, it, expect, vi, afterEach } from 'vitest';
import { normalizeDrivers, findSessionKey, fetchDrivers, fetchLineupForRace } from './openf1';

afterEach(() => {
  vi.unstubAllGlobals();
});

const rawDrivers = [
  { driver_number: 4, full_name: 'Lando NORRIS', team_name: 'McLaren', team_colour: 'FF8000' },
  { driver_number: 1, full_name: 'Max VERSTAPPEN', team_name: 'Red Bull Racing', team_colour: '3671C6' },
  { driver_number: 81, full_name: 'Oscar PIASTRI', team_name: 'McLaren', team_colour: 'FF8000' },
];

describe('normalizeDrivers', () => {
  it('sorts by driver_number and derives distinct teams', () => {
    const { drivers, teams } = normalizeDrivers(rawDrivers);
    expect(drivers.map((d) => d.label)).toEqual(['Max VERSTAPPEN', 'Lando NORRIS', 'Oscar PIASTRI']);
    expect(drivers.map((d) => d.grid)).toEqual([1, 2, 3]);
    expect(teams).toHaveLength(2);
    expect(teams.map((t) => t.label).sort()).toEqual(['McLaren', 'Red Bull Racing']);
  });

  it('links each driver to its team id', () => {
    const { drivers, teams } = normalizeDrivers(rawDrivers);
    const mclaren = teams.find((t) => t.label === 'McLaren');
    expect(drivers.filter((d) => d.teamId === mclaren?.id)).toHaveLength(2);
  });

  it('handles empty input', () => {
    expect(normalizeDrivers([])).toEqual({ drivers: [], teams: [] });
  });
});

function mockFetchSequence(responses: Array<{ ok: boolean; json: unknown }>) {
  let i = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const r = responses[Math.min(i, responses.length - 1)];
      i++;
      return { ok: r.ok, status: r.ok ? 200 : 500, json: async () => r.json };
    }),
  );
}

describe('findSessionKey', () => {
  const race = { country: 'Italy', locality: 'Monza', raceDate: '2024-09-01' };

  it('matches a session by country/location', async () => {
    mockFetchSequence([
      { ok: true, json: [{ session_key: 9590, session_type: 'Race', date_start: '2024-09-01T13:00:00Z', country_name: 'Italy', location: 'Monza' }] },
    ]);
    const res = await findSessionKey(2024, race);
    expect(res).toEqual({ ok: true, sessionKey: 9590 });
  });

  it('returns ok:false when no sessions exist for the year', async () => {
    mockFetchSequence([{ ok: true, json: [] }]);
    const res = await findSessionKey(2026, race);
    expect(res.ok).toBe(false);
  });

  it('returns ok:false on network failure without throwing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down'); }));
    const res = await findSessionKey(2024, race);
    expect(res).toEqual({ ok: false, reason: 'network down' });
  });

  it('returns ok:false when no session matches the country/location', async () => {
    mockFetchSequence([
      { ok: true, json: [{ session_key: 1, session_type: 'Race', date_start: '2024-01-01T00:00:00Z', country_name: 'Bahrain', location: 'Sakhir' }] },
    ]);
    const res = await findSessionKey(2024, race);
    expect(res.ok).toBe(false);
  });
});

describe('fetchDrivers', () => {
  it('returns ok:false when the entry list is empty (future race)', async () => {
    mockFetchSequence([{ ok: true, json: [] }]);
    const res = await fetchDrivers(11234);
    expect(res).toEqual({ ok: false, reason: 'no entry list yet for this session' });
  });

  it('returns normalized data on success', async () => {
    mockFetchSequence([{ ok: true, json: rawDrivers }]);
    const res = await fetchDrivers(9590);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.sessionKey).toBe(9590);
      expect(res.drivers).toHaveLength(3);
      expect(res.teams).toHaveLength(2);
    }
  });

  it('returns ok:false on http error without throwing', async () => {
    mockFetchSequence([{ ok: false, json: null }]);
    const res = await fetchDrivers(9590);
    expect(res.ok).toBe(false);
  });
});

describe('fetchLineupForRace', () => {
  const race = { country: 'Italy', locality: 'Monza', raceDate: '2024-09-01' };

  it('chains session lookup then drivers fetch', async () => {
    mockFetchSequence([
      { ok: true, json: [{ session_key: 9590, session_type: 'Race', date_start: '2024-09-01T13:00:00Z', country_name: 'Italy', location: 'Monza' }] },
      { ok: true, json: rawDrivers },
    ]);
    const res = await fetchLineupForRace(2024, race);
    expect(res.ok).toBe(true);
  });

  it('propagates a session-not-found failure without fetching drivers', async () => {
    mockFetchSequence([{ ok: true, json: [] }]);
    const res = await fetchLineupForRace(2026, race);
    expect(res.ok).toBe(false);
  });
});
