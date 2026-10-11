import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSchedule, fetchDriverStandings, fetchConstructorStandings } from '../lib/f1api';
import { fetchSessions, fetchResults, fetchLaps, fetchTyreUse, fetchSessionWeather, fetchForecast, clearMemoryCache } from '../lib/raceData';
import { findSessionKey, fetchDrivers, fetchLineupForRace } from '../lib/openf1';
import { installMockNet, uninstallMockNet, getMockNetState } from './mockNet';

const realFetch = vi.fn(async () => new Response('real', { status: 200 }));
const origFetch = globalThis.fetch;

beforeEach(() => {
  globalThis.fetch = realFetch as unknown as typeof fetch;
  realFetch.mockClear();
  clearMemoryCache();
});

afterEach(() => {
  clearMemoryCache();
  uninstallMockNet();
  globalThis.fetch = origFetch;
  vi.unstubAllEnvs();
});

describe('scenarios', () => {
  it(
    'completed scenario serves real data to all data layer functions',
    async () => {
      installMockNet('completed');

      // raceData functions for the Malaysia finished weekend (meeting 1308, race session 11731)
      const sessions = await fetchSessions(1308);
      expect(sessions.length).toBeGreaterThan(0);

      const results = await fetchResults(11731);
      expect(results.length).toBeGreaterThan(10);

      const laps = await fetchLaps(11731);
      expect(laps.length).toBeGreaterThan(0);

      const tyres = await fetchTyreUse(11731);
      expect(tyres.length).toBeGreaterThan(0);

      const weather = await fetchSessionWeather(11731);
      expect(weather).not.toBeNull();

      const forecast = await fetchForecast(1.46, 103.76, '2026-10-04', '2026-10-05');
      expect(forecast.hours.length).toBeGreaterThan(0);

      // f1api functions (Jolpica)
      const schedule = await fetchSchedule(2026);
      expect(schedule).not.toBeNull();
      expect(schedule?.size).toBeGreaterThan(0);

      const driverStandings = await fetchDriverStandings(2026);
      expect(driverStandings).not.toBeNull();
      expect(driverStandings?.rows.length).toBeGreaterThan(0);

      const constructorStandings = await fetchConstructorStandings(2026);
      expect(constructorStandings).not.toBeNull();
      expect(constructorStandings?.rows.length).toBeGreaterThan(0);

      // openf1 functions
      const sessionKey = await findSessionKey(2026, { country: 'Malaysia', locality: 'Kuala Lumpur', raceDate: '2026-10-04' });
      expect(sessionKey.ok).toBe(true);

      const drivers = await fetchDrivers(11731);
      expect(drivers.ok).toBe(true);
      if (drivers.ok) {
        expect(drivers.drivers.length).toBeGreaterThan(0);
        expect(drivers.teams.length).toBeGreaterThan(0);
      }

      const lineup = await fetchLineupForRace(2026, { country: 'Malaysia', locality: 'Kuala Lumpur', raceDate: '2026-10-04' });
      expect(lineup.ok).toBe(true);
      if (lineup.ok) {
        expect(lineup.drivers.length).toBeGreaterThan(0);
        expect(lineup.teams.length).toBeGreaterThan(0);
      }

      // Verify nothing escaped to the network
      expect(realFetch).not.toHaveBeenCalled();
    },
    30_000,
  );

  it(
    'upcoming scenario serves sessions but withholds session-keyed data',
    async () => {
      installMockNet('upcoming');

      // Singapore sessions should be available
      const sessions = await fetchSessions(1296);
      expect(sessions.length).toBeGreaterThan(0);

      // But the finished weekend's session-keyed data should be empty or failed
      const laps = await fetchLaps(11731);
      expect(laps).toEqual([]);

      const tyres = await fetchTyreUse(11731);
      expect(tyres).toEqual([]);

      const drivers = await fetchDrivers(11731);
      expect(drivers.ok).toBe(false);

      expect(realFetch).not.toHaveBeenCalled();
    },
    20_000,
  );

  it(
    'no-data scenario returns empty arrays for OpenF1 but Jolpica still works',
    async () => {
      installMockNet('no-data');

      // OpenF1 arrays all come back empty
      const sessions = await fetchSessions(1308);
      expect(sessions).toEqual([]);

      const results = await fetchResults(11731);
      expect(results).toEqual([]);

      const laps = await fetchLaps(11731);
      expect(laps).toEqual([]);

      const tyres = await fetchTyreUse(11731);
      expect(tyres).toEqual([]);

      const weather = await fetchSessionWeather(11731);
      expect(weather).toBeNull();

      // OpenF1 calls return ok: false
      const drivers = await fetchDrivers(11731);
      expect(drivers.ok).toBe(false);
      expect(typeof drivers.ok === 'boolean' && !drivers.ok && 'reason' in drivers).toBe(true);

      const sessionKey = await findSessionKey(2026, { country: 'Malaysia', locality: 'Kuala Lumpur', raceDate: '2026-10-04' });
      expect(sessionKey.ok).toBe(false);

      // Jolpica still works
      const schedule = await fetchSchedule(2026);
      expect(schedule).not.toBeNull();
      expect(schedule?.size).toBeGreaterThan(0);

      expect(realFetch).not.toHaveBeenCalled();
    },
    20_000,
  );

  it(
    'rate-limited scenario: OpenF1 returns 429, Jolpica still works',
    async () => {
      installMockNet('rate-limited');

      // lib/openf1 does not retry, so it should return ok: false with a 429-related reason
      const sessionKey = await findSessionKey(2026, { country: 'Malaysia', locality: 'Kuala Lumpur', raceDate: '2026-10-04' });
      expect(sessionKey.ok).toBe(false);
      expect((sessionKey as { reason?: string }).reason).toMatch(/429|Rate/i);

      const drivers = await fetchDrivers(11731);
      expect(drivers.ok).toBe(false);
      expect((drivers as { reason?: string }).reason).toMatch(/429|Rate/i);

      const lineup = await fetchLineupForRace(2026, { country: 'Malaysia', locality: 'Kuala Lumpur', raceDate: '2026-10-04' });
      expect(lineup.ok).toBe(false);

      // Jolpica (f1api) is not rate-limited by the mock, so it still works
      const schedule = await fetchSchedule(2026);
      expect(schedule).not.toBeNull();
      expect(schedule?.size).toBeGreaterThan(0);

      // NOTE: lib/raceData functions (fetchSessions, fetchResults, fetchLaps, fetchTyreUse,
      // fetchSessionWeather) are deliberately NOT tested here because raceData's fetchJson
      // retries a 429 three times with 2500ms then 5000ms backoff, taking ~7.5s total,
      // making the test unacceptably slow. The rate-limiting behavior for these functions
      // is covered by mocking in unit tests specific to raceData itself.

      expect(realFetch).not.toHaveBeenCalled();
    },
    20_000,
  );

  it(
    'offline scenario: raceData rejects with TypeError, openf1 returns ok: false',
    async () => {
      installMockNet('offline');

      // raceData functions reject with TypeError
      await expect(fetchSessions(1308)).rejects.toBeInstanceOf(TypeError);
      await expect(fetchResults(11731)).rejects.toBeInstanceOf(TypeError);
      await expect(fetchLaps(11731)).rejects.toBeInstanceOf(TypeError);
      await expect(fetchTyreUse(11731)).rejects.toBeInstanceOf(TypeError);
      await expect(fetchSessionWeather(11731)).rejects.toBeInstanceOf(TypeError);
      await expect(fetchForecast(1.46, 103.76, '2026-10-04', '2026-10-05')).rejects.toBeInstanceOf(TypeError);

      // openf1 calls return ok: false (getJson throws, which is caught)
      const sessionKey = await findSessionKey(2026, { country: 'Malaysia', locality: 'Kuala Lumpur', raceDate: '2026-10-04' });
      expect(sessionKey.ok).toBe(false);

      const drivers = await fetchDrivers(11731);
      expect(drivers.ok).toBe(false);

      // Verify that at least one call is recorded with offline rejection
      const state = getMockNetState();
      const offlineReject = state.calls.some((c) => c.status === 'reject' && c.served === 'offline');
      expect(offlineReject).toBe(true);

      expect(realFetch).not.toHaveBeenCalled();
    },
    20_000,
  );
});
