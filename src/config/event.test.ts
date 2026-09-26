import { describe, it, expect } from 'vitest';
import { DRIVERS, TEAMS, buildDefaultEvent, validateEventConfig } from './event';
import { ALL_RACES } from './calendar';

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
  const ev = buildDefaultEvent(ALL_RACES[0]);
  it('opens at race start and closes 81 minutes later for 90 min default', () => {
    expect(ev.raceDurationMin).toBe(90);
    expect(ev.opensAt.toMillis()).toBe(ev.raceStartUtc.toMillis());
    expect(ev.closesAt.toMillis() - ev.opensAt.toMillis()).toBe(81 * 60_000);
  });
  it('scales close with duration', () => {
    const e = buildDefaultEvent(ALL_RACES[0], 100);
    expect(e.closesAt.toMillis() - e.opensAt.toMillis()).toBe(90 * 60_000);
  });
  it('has 22 drivers, 11 teams, 5 questions with mirrored ids', () => {
    expect(ev.drivers).toHaveLength(22);
    expect(ev.teams).toHaveLength(11);
    expect(ev.questions).toHaveLength(5);
    expect(ev.questionIds).toEqual(ev.questions.map((q) => q.id));
    expect(ev.drivers.every((d) => ev.teams.some((t) => t.id === d.teamId))).toBe(true);
    expect(ev.override).toBe('none');
  });
});
