import { describe, expect, it } from 'vitest';
import { boldCalls, crowdBreakdown, roomAccuracy } from './crowd';
import type { ScorableEntry } from './types';

const mk = (uid: string, q1: string, q2 = 'x'): ScorableEntry => ({
  uid,
  name: uid.toUpperCase(),
  answers: { q1, q2 },
  submittedAtMs: 0,
});

describe('crowdBreakdown', () => {
  it('handles an empty room without NaN', () => {
    const b = crowdBreakdown([], { q1: ['ver'] }, ['q1']);
    expect(b[0]).toMatchObject({ total: 0, picks: [], roomRight: 0, roomRightShare: 0, voided: false });
    expect(roomAccuracy(b)).toEqual({ percent: 0, answered: 0, scored: 0 });
  });
  it('flags voided questions and excludes them from the meter', () => {
    const es = [mk('a', 'ver', 'x'), mk('b', 'nor', 'x')];
    const b = crowdBreakdown(es, { q1: ['ver'], q2: [] }, ['q1', 'q2']);
    expect(b[1].voided).toBe(true);
    expect(b[1].roomRight).toBe(0);
    expect(roomAccuracy(b)).toEqual({ percent: 50, answered: 2, scored: 1 });
  });
  it('supports multiple accepted answers and normalizes ids', () => {
    const es = [mk('a', ' VER '), mk('b', 'nor'), mk('c', 'ham')];
    const b = crowdBreakdown(es, { q1: ['ver', 'NOR'] }, ['q1']);
    expect(b[0].roomRight).toBe(2);
    expect(b[0].roomRightShare).toBeCloseTo(2 / 3);
  });
  it('sorts by count desc, ties by id', () => {
    const es = [mk('a', 'zed'), mk('b', 'abe'), mk('c', 'mid'), mk('d', 'mid')];
    const b = crowdBreakdown(es, { q1: ['abe'] }, ['q1']);
    expect(b[0].picks.map((p) => p.optionId)).toEqual(['mid', 'abe', 'zed']);
    expect(b[0].picks[0]).toMatchObject({ count: 2, share: 0.5 });
  });
  it('ignores unanswered entries in totals', () => {
    const b = crowdBreakdown([mk('a', ''), mk('b', 'ver')], { q1: ['ver'] }, ['q1']);
    expect(b[0].total).toBe(1);
    expect(b[0].roomRightShare).toBe(1);
  });
});

describe('roomAccuracy', () => {
  it('rounds the mean to an integer percent', () => {
    const es = [mk('a', 'ver'), mk('b', 'ver'), mk('c', 'nor')];
    expect(roomAccuracy(crowdBreakdown(es, { q1: ['ver'] }, ['q1'])).percent).toBe(67);
  });
});

describe('boldCalls', () => {
  const five = [mk('a', 'nor'), mk('b', 'nor'), mk('c', 'nor'), mk('d', 'nor'), mk('e', 'ver')];
  const six = [...five, mk('f', 'nor')];
  it('threshold is strict: exactly maxShare is not bold', () => {
    expect(boldCalls(five, { q1: ['ver'] }, ['q1'])).toEqual([]);
  });
  it('lists right guests whose pick was under the threshold', () => {
    const calls = boldCalls(six, { q1: ['ver'] }, ['q1']);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ uid: 'e', questionId: 'q1', optionId: 'ver' });
    expect(calls[0].share).toBeCloseTo(1 / 6);
    expect(boldCalls(six, { q1: ['ver'] }, ['q1'], 0.1)).toHaveLength(0);
  });
  it('needs at least 5 answers and skips voided', () => {
    expect(boldCalls(five.slice(0, 4), { q1: ['nor'] }, ['q1'], 1)).toHaveLength(0);
    expect(boldCalls(six, { q1: [] }, ['q1'])).toHaveLength(0);
  });
});
