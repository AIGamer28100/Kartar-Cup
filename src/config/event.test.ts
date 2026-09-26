import { describe, it, expect } from 'vitest';
import { DRIVERS, TEAMS, validateEventConfig } from './event';

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
