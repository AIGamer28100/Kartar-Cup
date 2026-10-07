import { describe, it, expect } from 'vitest';
import { rankEntries } from '../../lib/scoring';
import type { Answers, Results, ScorableEntry } from '../../lib/types';
import { buildPodium, clampStage, isRevealed, nextStage, prevStage } from './podium';

const R: Results = { q1: ['a'], q2: ['b'] };
const win: Answers = { q1: 'a', q2: 'b' };
const half: Answers = { q1: 'a', q2: 'x' };
const zero: Answers = { q1: 'x', q2: 'x' };
const ids = ['q1', 'q2'];

const e = (uid: string, ms: number, answers: Answers): ScorableEntry => ({
  uid,
  name: uid,
  answers,
  submittedAtMs: ms,
});

describe('buildPodium', () => {
  it('picks top 3 off rankEntries output, in rank order', () => {
    const rows = rankEntries(
      [e('a', 1, win), e('b', 2, half), e('c', 3, zero), e('d', 4, zero)],
      R,
      null,
      ids,
    );
    const p = buildPodium(rows);
    expect(p.p1?.uid).toBe('a');
    expect(p.p2?.uid).toBe('b');
    expect(p.p3?.uid).toBe('c');
  });

  it('fewer than 3 entries leaves remaining slots null', () => {
    const rows = rankEntries([e('a', 1, win)], R, null, ids);
    const p = buildPodium(rows);
    expect(p.p1?.uid).toBe('a');
    expect(p.p2).toBeNull();
    expect(p.p3).toBeNull();
  });

  it('zero entries: all null', () => {
    const p = buildPodium([]);
    expect(p).toEqual({ p1: null, p2: null, p3: null });
  });

  it('respects tiebreak override baked into rankEntries', () => {
    // both zero score, b is later submission but wins the override
    const rows = rankEntries([e('a', 1, zero), e('b', 2, zero)], R, 'b', ids);
    const p = buildPodium(rows);
    expect(p.p1?.uid).toBe('b');
  });
});

describe('stage helpers', () => {
  it('nextStage clamps at 3', () => {
    expect(nextStage(0)).toBe(1);
    expect(nextStage(3)).toBe(3);
  });
  it('prevStage clamps at 0', () => {
    expect(prevStage(1)).toBe(0);
    expect(prevStage(0)).toBe(0);
  });
  it('clampStage rounds and bounds into 0..3', () => {
    expect(clampStage(-5)).toBe(0);
    expect(clampStage(9)).toBe(3);
    expect(clampStage(1.6)).toBe(2);
  });
});

describe('isRevealed', () => {
  it('p3 reveals at stage 1, p2 at 2, p1 at 3', () => {
    expect(isRevealed(0, 'p3')).toBe(false);
    expect(isRevealed(1, 'p3')).toBe(true);
    expect(isRevealed(1, 'p2')).toBe(false);
    expect(isRevealed(2, 'p2')).toBe(true);
    expect(isRevealed(2, 'p1')).toBe(false);
    expect(isRevealed(3, 'p1')).toBe(true);
  });
  it('already-revealed steps stay revealed at later stages', () => {
    expect(isRevealed(3, 'p3')).toBe(true);
    expect(isRevealed(3, 'p2')).toBe(true);
  });
});
