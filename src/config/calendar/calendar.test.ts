import { describe, expect, it } from 'vitest';
import { ALL_RACES, getRace } from './index';
import { nextRace } from './types';

const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

describe('calendar', () => {
  it('ids unique', () => {
    expect(new Set(ALL_RACES.map((r) => r.id)).size).toBe(ALL_RACES.length);
  });
  it('dates valid and ordered', () => {
    for (const r of ALL_RACES) {
      expect(valid(r.weekendStart) && valid(r.weekendEnd) && valid(r.raceDate)).toBe(true);
      expect(r.weekendStart <= r.raceDate && r.raceDate <= r.weekendEnd).toBe(true);
      expect(r.themeId).toBe(r.id);
    }
  });
  it('2027 has 24 rounds', () => {
    expect(ALL_RACES.filter((r) => r.season === 2027)).toHaveLength(24);
  });
  it('2026 contains R16 malaysia', () => {
    expect(getRace('2026-r16-malaysia')?.round).toBe(16);
  });
  it('nextRace on 2026-09-27 is Malaysia', () => {
    expect(nextRace(new Date('2026-09-27T12:00:00Z'), ALL_RACES)?.id).toBe('2026-r16-malaysia');
  });
  it('nextRace skips cancelled-by-host Baku', () => {
    expect(nextRace(new Date('2026-09-25T12:00:00Z'), ALL_RACES)?.id).toBe('2026-r16-malaysia');
  });
});
