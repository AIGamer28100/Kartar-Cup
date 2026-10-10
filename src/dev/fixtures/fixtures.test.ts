import { describe, expect, it } from 'vitest';
import { mockBookingEvent, mockCards, mockEntries, mockEventConfig, mockMaxScore, mockRanked, mockResults } from './index';

describe('mock fixtures', () => {
  it('are deterministic across calls', () => {
    expect(mockEntries()).toEqual(mockEntries());
    expect(mockRanked()).toEqual(mockRanked());
    expect(mockResults()).toEqual(mockResults());
    expect(mockBookingEvent()).toEqual(mockBookingEvent());
    expect(mockCards()).toEqual(mockCards());
  });

  it('build the five-question Malaysia grid from the captured drivers', () => {
    const cfg = mockEventConfig();
    expect(cfg.questions).toHaveLength(5);
    expect(cfg.drivers.length).toBe(22);
    expect(mockMaxScore()).toBeGreaterThanOrEqual(5);
  });

  it('rank in descending score order', () => {
    const scores = mockRanked().map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('cover every discount kind used by the booking fixture', () => {
    const kinds = new Set(mockBookingEvent().discounts.map((d) => d.kind));
    expect(kinds.has('percent') && kinds.has('flat') && kinds.has('group')).toBe(true);
  });
});
