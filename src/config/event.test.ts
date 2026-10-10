import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DRIVERS, TEAMS, buildDefaultEvent, validateEventConfig } from './event';
import { ALL_RACES } from './calendar';

// buildDefaultEvent fetches OpenF1 first; force the fallback path so these tests stay
// hermetic (no real network) and assert the static template grid.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('no network in tests'); }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('event config', () => {
  it('is valid', () => {
    expect(validateEventConfig()).toEqual([]);
  });
  it("each driver's team is in TEAMS", () => {
    for (const d of DRIVERS) {
      expect(TEAMS.map((t) => t.label)).toContain((d.sub ?? '').split(' · ')[0]);
    }
  });
});

describe('buildDefaultEvent', () => {
  it('opens 10 minutes before lights out and closes at 30% of a 90 min race (27 minutes in)', async () => {
    const { config: ev } = await buildDefaultEvent(ALL_RACES[0]);
    expect(ev.raceDurationMin).toBe(90);
    expect(ev.raceStartUtc.toMillis() - ev.opensAt.toMillis()).toBe(10 * 60_000);
    expect(ev.closesAt.toMillis() - ev.raceStartUtc.toMillis()).toBe(27 * 60_000);
  });
  it('scales close with duration', async () => {
    const { config: e } = await buildDefaultEvent(ALL_RACES[0], 100);
    expect(e.closesAt.toMillis() - e.raceStartUtc.toMillis()).toBe(30 * 60_000);
  });
  it('takes the total laps from the race facts', async () => {
    const { factsFor } = await import('./tracks/raceFacts');
    const { config: e } = await buildDefaultEvent(ALL_RACES[0]);
    expect(e.totalLaps).toBe(factsFor(ALL_RACES[0].id)?.laps);
  });
  it('has 22 drivers, 11 teams, 5 questions with mirrored ids, falling back to the static grid without network', async () => {
    const { config: ev, gridStatus } = await buildDefaultEvent(ALL_RACES[0]);
    expect(gridStatus.kind).toBe('error');
    expect(ev.drivers).toHaveLength(22);
    expect(ev.teams).toHaveLength(11);
    expect(ev.questions).toHaveLength(5);
    expect(ev.questionIds).toEqual(ev.questions.map((q) => q.id));
    expect(ev.drivers.every((d) => ev.teams.some((t) => t.id === d.teamId))).toBe(true);
    expect(ev.override).toBe('none');
  });
});
