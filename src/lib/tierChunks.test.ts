import { describe, expect, it } from 'vitest';
import { planTierChunks } from './tierChunks';

const tiers = (n: number, tag = 'a') => Array.from({ length: n }, (_, i) => ({ name: `${tag}${i}` }));

describe('planTierChunks', () => {
  it('writes up to 5 new tiers in one step', () => {
    const p = planTierChunks(null, tiers(5));
    expect(p.steps).toHaveLength(1);
    expect(p.totalChanged).toBe(5);
  });
  it('splits a 10-tier create into two steps of 5', () => {
    const p = planTierChunks(null, tiers(10));
    expect(p.steps.map((s) => [s.tiers.length, s.savedTiers])).toEqual([[5, 5], [10, 10]]);
  });
  it('counts only changed tiers on update', () => {
    const old = tiers(10);
    const next = old.map((t, i) => (i < 7 ? { name: `x${i}` } : t));
    const p = planTierChunks(old, next);
    expect(p.totalChanged).toBe(7);
    expect(p.steps).toHaveLength(2);
    expect(p.steps[0].tiers[5]).toEqual(old[5]); // not reached yet
    expect(p.steps[1].tiers).toEqual(next);
  });
  it('no change is a single step', () => {
    expect(planTierChunks(tiers(8), tiers(8)).steps).toHaveLength(1);
  });
});
