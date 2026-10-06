import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { QUESTIONS } from '../config/event';
import { configToForm, formToConfig, validate } from '../host/settings/model';
import { optionLabel, optionsFor, scoreOwn } from '../guest/model';
import { boldCalls, crowdBreakdown, roomAccuracy } from './crowd';
import { toCsv } from './csv';
import { mapFactsToQuestions } from './raceResults';
import { maxScore, pointsMap, pointsOf, rankEntries, scoreEntry } from './scoring';
import type { Answers, EventConfig, QuestionCfg, Results, ScorableEntry } from './types';
import { YESNO_OPTIONS } from './types';

const R: Results = { q1: ['mercedes'], q2: ['norris', 'piastri'], q3: ['stroll'], q4: ['haas'], q5: ['russell'] };
const A: Answers = { q1: 'mercedes', q2: 'norris', q3: 'stroll', q4: 'haas', q5: 'russell' };
const e = (uid: string, ms: number, answers: Answers): ScorableEntry => ({ uid, name: uid, answers, submittedAtMs: ms });

describe('regression: default 5-question scoring is unchanged', () => {
  const qs: QuestionCfg[] = QUESTIONS.map((q) => ({ ...q }));
  it('no points argument = 1 per correct answer', () => {
    expect(scoreEntry(A, R).score).toBe(5);
    expect(scoreEntry({ ...A, q1: 'x', q3: 'x' }, R).score).toBe(3);
  });
  it('a points map of all 1s gives the identical result to no map', () => {
    for (const a of [A, { ...A, q2: 'x' }, { ...A, q1: 'x', q4: '' }]) {
      expect(scoreEntry(a, R, undefined, pointsMap(qs))).toEqual(scoreEntry(a, R));
    }
  });
  it('the shipped question set carries no points and is worth 5 in total', () => {
    expect(qs.every((q) => q.points === undefined)).toBe(true);
    expect(maxScore(qs)).toBe(5);
  });
  it('rankEntries order, ranks and tie flags are identical with and without the map', () => {
    const entries = [e('a', 200, A), e('b', 100, A), e('c', 50, { ...A, q1: 'x' })];
    expect(rankEntries(entries, R, null, undefined, pointsMap(qs))).toEqual(rankEntries(entries, R));
  });
  it('voided questions score nothing regardless of points', () => {
    const v: Results = { ...R, q1: [] };
    expect(scoreEntry(A, v, undefined, { q1: 10 }).score).toBe(4);
  });
});

describe('pointsOf', () => {
  it('defaults to 1 and rejects bad values', () => {
    expect(pointsOf({})).toBe(1);
    for (const p of [0, -2, 1.5, 11, NaN, Infinity]) expect(pointsOf({ points: p })).toBe(1);
    expect(pointsOf({ points: '3' as unknown as number })).toBe(1);
  });
  it('accepts 1..10', () => {
    expect(pointsOf({ points: 1 })).toBe(1);
    expect(pointsOf({ points: 10 })).toBe(10);
  });
});

describe('weighted scoring', () => {
  const pts = { q2: 3, q5: 2 };
  it('adds each correct question its points', () => {
    expect(scoreEntry(A, R, undefined, pts).score).toBe(1 + 3 + 1 + 1 + 2);
    expect(scoreEntry({ ...A, q2: 'x' }, R, undefined, pts).score).toBe(1 + 1 + 1 + 2);
  });
  it('ticks are unaffected by points', () => {
    expect(scoreEntry({ ...A, q2: 'x' }, R, undefined, pts).ticks.q2).toBe(false);
  });
  it('a heavy question outranks more light ones', () => {
    const heavy = e('heavy', 2, { q1: 'x', q2: 'x', q3: 'x', q4: 'x', q5: 'russell' });
    const light = e('light', 1, { q1: 'mercedes', q2: 'x', q3: 'stroll', q4: 'x', q5: 'x' });
    const rows = rankEntries([light, heavy], R, null, undefined, { q5: 5 });
    expect(rows.map((r) => r.uid)).toEqual(['heavy', 'light']);
    expect(rows.map((r) => r.score)).toEqual([5, 2]);
  });
  it('tie on weighted score still falls back to earlier submission, then host override', () => {
    const a = e('a', 200, { ...A, q1: 'x' });
    const b = e('b', 100, { ...A, q2: 'x' });
    const pts2 = { q1: 2, q2: 2 };
    expect(rankEntries([a, b], R, null, undefined, pts2).map((r) => r.uid)).toEqual(['b', 'a']);
    const over = rankEntries([a, b], R, 'a', undefined, pts2);
    expect(over.map((r) => r.uid)).toEqual(['a', 'b']);
    expect(over.every((r) => r.tiedOnScore)).toBe(true);
  });
  it('override cannot jump a heavier score', () => {
    const top = e('top', 100, A);
    const low = e('low', 50, { ...A, q1: 'x' });
    expect(rankEntries([low, top], R, 'low', undefined, { q1: 4 }).map((r) => r.uid)).toEqual(['top', 'low']);
  });
  it('maxScore sums points', () => {
    expect(maxScore([{ points: 3 }, {}, { points: 10 }])).toBe(14);
  });
  it('scoreOwn uses the event config points', () => {
    const cfg = { questionIds: ['q1', 'q2'], questions: [{ id: 'q1', points: 4 }, { id: 'q2' }] } as unknown as EventConfig;
    expect(scoreOwn(cfg, { q1: 'a', q2: 'b' }, { q1: ['a'], q2: ['b'] }).score).toBe(5);
  });
});

describe('weighted CSV', () => {
  it('writes the weighted score', () => {
    const rows = rankEntries([e('a', 1, A)], R, null, undefined, { q2: 3 });
    const out = toCsv(rows.map((r) => ({ ...r, submittedAtIso: '2026-01-01T00:00:00Z' })));
    expect(out.split('\r\n')[1]).toBe('1,a,,,7,2026-01-01T00:00:00Z,7,0');
  });
});

describe('yesno question', () => {
  const yn: QuestionCfg = { id: 'q6', kind: 'yesno', prompt: 'Safety car?', points: 2 };
  const cfg = { teams: [], drivers: [], questions: [yn], questionIds: ['q6'] } as unknown as EventConfig;
  it('has fixed options yes/no', () => {
    expect(optionsFor(cfg, yn)).toEqual(YESNO_OPTIONS);
    expect(YESNO_OPTIONS.map((o) => o.id)).toEqual(['yes', 'no']);
    expect(optionLabel(cfg, yn, 'no')).toBe('No');
  });
  it('scores like any kind, voided [] scores nothing', () => {
    expect(scoreEntry({ q6: 'yes' }, { q6: ['yes'] }, ['q6'], pointsMap([yn])).score).toBe(2);
    expect(scoreEntry({ q6: 'no' }, { q6: ['yes'] }, ['q6'], pointsMap([yn])).score).toBe(0);
    expect(scoreEntry({ q6: 'yes' }, { q6: [] }, ['q6'], pointsMap([yn])).score).toBe(0);
  });
  it('crowd accuracy stays per-question share and ignores points', () => {
    const entries = [e('a', 1, { q6: 'yes' }), e('b', 2, { q6: 'yes' }), e('c', 3, { q6: 'no' }), e('d', 4, { q6: 'yes' })];
    const b = crowdBreakdown(entries, { q6: ['yes'] }, ['q6']);
    expect(b[0].roomRight).toBe(3);
    expect(roomAccuracy(b).percent).toBe(75);
    expect(boldCalls(entries, { q6: ['yes'] }, ['q6'])).toEqual([]);
  });
  it('OpenF1 prefill ignores yesno questions, even when the prompt looks like a fact', () => {
    const facts = {
      slowestPitTeams: [], fastestPitTeams: [], mostOvertakeDrivers: [], dnfDrivers: ['lando-norris'], fastestLapDrivers: [], notes: [],
    };
    const out = mapFactsToQuestions(
      facts,
      [
        { id: 'q6', kind: 'yesno', prompt: 'Which driver will DNF?' },
        { id: 'q7', kind: 'yesno', prompt: 'Safety car?' },
      ],
      { team: new Set(), driver: new Set(['lando-norris']) },
    );
    expect(out.answers).toEqual({});
    expect(out.filled).toEqual([]);
    expect(out.skipped).toEqual([]);
  });
});

describe('settings form round-trip', () => {
  const now = Timestamp.fromMillis(1_800_000_000_000);
  const base = (questions: QuestionCfg[]): EventConfig => ({
    id: 'ev', raceId: 'custom', name: 'N', subtitle: '', circuit: null, themeId: 't',
    raceStartUtc: now, raceDurationMin: 90, opensAt: now, closesAt: Timestamp.fromMillis(now.toMillis() + 4_860_000),
    override: 'none', whatsappUrl: '', teams: [{ id: 'a', label: 'A' }],
    drivers: [{ id: 'd', label: 'D', teamId: 'a', grid: 1 }],
    questions, questionIds: questions.map((q) => q.id), winnerRevealed: false, tiebreakOverride: null,
    createdAt: now, updatedAt: now,
  });
  it('default questions round-trip with no points field written', () => {
    const out = formToConfig(configToForm(base(QUESTIONS.map((q) => ({ ...q })))));
    expect(out.questions.every((q) => !('points' in q))).toBe(true);
    expect(out.questions.map((q) => q.kind)).toEqual(QUESTIONS.map((q) => q.kind));
  });
  it('points > 1 and yesno are persisted; points 1 is stored as absence', () => {
    const f = configToForm(base([
      { id: 'q1', kind: 'yesno', prompt: 'Rain?', points: 3 },
      { id: 'q2', kind: 'driver', prompt: 'Winner?', points: 1 },
    ]));
    const out = formToConfig(f);
    expect(out.questions[0]).toMatchObject({ kind: 'yesno', points: 3 });
    expect('points' in out.questions[1]).toBe(false);
  });
  it('validate rejects out-of-range points', () => {
    const f = configToForm(base([{ id: 'q1', kind: 'driver', prompt: 'W?' }]));
    expect(validate({ ...f, questions: [{ ...f.questions[0], points: 11 }] }).questions).toMatch(/1 to 10/);
    expect(validate({ ...f, questions: [{ ...f.questions[0], points: 2.5 }] }).questions).toMatch(/1 to 10/);
    expect(validate({ ...f, questions: [{ ...f.questions[0], points: 10 }] }).questions).toBeUndefined();
  });
});
