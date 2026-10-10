import { describe, expect, it } from 'vitest';
import { ALL_RACES } from '../calendar';
import { OPENF1_IDS, openF1IdsFor } from './openf1Ids';

describe('openF1IdsFor', () => {
  it('returns the ids of a mapped race and undefined otherwise', () => {
    expect(openF1IdsFor('2026-r17-singapore')).toEqual({ meetingKey: 1296, circuitKey: 61 });
    expect(openF1IdsFor('nope')).toBeUndefined();
  });
  it('only maps races on the calendar, with unique meeting keys', () => {
    const ids = new Set(ALL_RACES.map((r) => r.id));
    for (const k of Object.keys(OPENF1_IDS)) expect(ids.has(k), k).toBe(true);
    const keys = Object.values(OPENF1_IDS).map((v) => v.meetingKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
