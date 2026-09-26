import { describe, it, expect } from 'vitest';
import { rankEntries, scoreEntry, winner } from './scoring';
import type { Answers, Results, ScorableEntry } from './types';

const R: Results = { q1: ['mercedes'], q2: ['norris', 'piastri'], q3: ['stroll'], q4: ['haas'], q5: ['russell'] };
const A: Answers = { q1: 'mercedes', q2: 'norris', q3: 'stroll', q4: 'haas', q5: 'russell' };
const wrong: Answers = { q1: 'x', q2: 'x', q3: 'x', q4: 'x', q5: 'x' };
const e = (uid: string, ms: number, answers: Answers): ScorableEntry => ({ uid, name: uid, answers, submittedAtMs: ms });

describe('scoreEntry', () => {
  it('all correct = 5', () => expect(scoreEntry(A, R).score).toBe(5));
  it('multi-answer credits both', () => {
    expect(scoreEntry({ ...wrong, q2: 'norris' }, R).ticks.q2).toBe(true);
    expect(scoreEntry({ ...wrong, q2: 'piastri' }, R).ticks.q2).toBe(true);
  });
  it('case/whitespace-insensitive', () => {
    expect(scoreEntry({ ...A, q1: '  MerCedes ' }, R).score).toBe(5);
  });
  it('voided gives 0', () => {
    const v: Results = { q1: [], q2: [], q3: [], q4: [], q5: [] };
    expect(scoreEntry(A, v).score).toBe(0);
  });
});

describe('rankEntries', () => {
  it('earlier submittedAtMs wins ties', () => {
    const rows = rankEntries([e('a', 200, A), e('b', 100, A)], R);
    expect(rows.map((r) => r.uid)).toEqual(['b', 'a']);
    expect(rows[0].tiedOnScore).toBe(true);
    expect(rows[1].rank).toBe(2);
  });
  it('equal ms falls back to uid', () => {
    const rows = rankEntries([e('b', 100, A), e('a', 100, A)], R);
    expect(rows.map((r) => r.uid)).toEqual(['a', 'b']);
  });
  it('override inside top group moves to #1', () => {
    const rows = rankEntries([e('a', 100, A), e('b', 200, A)], R, 'b');
    expect(rows.map((r) => r.uid)).toEqual(['b', 'a']);
    expect(rows.map((r) => r.rank)).toEqual([1, 2]);
  });
  it('override outside top group is ignored', () => {
    const rows = rankEntries([e('a', 100, A), e('c', 50, wrong)], R, 'c');
    expect(rows[0].uid).toBe('a');
  });
  it('empty entries gives null winner', () => {
    expect(winner(rankEntries([], R))).toBeNull();
  });
});
