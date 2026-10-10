import { describe, expect, it } from 'vitest';
import {
  clampQuizWindow,
  defaultQuizWindow,
  isQuizWindowAllowed,
  quizEarliestOpenMs,
  quizExtendRoomMin,
  quizLatestCloseMs,
  clampLap,
  closeLap,
  lightsOutClosesAtMs,
  quizCloseReason,
  quizExtendedPastCap,
  quizIsClosed,
} from './quizWindow';

const START = Date.UTC(2026, 9, 11, 12, 0); // lights out 12:00Z
const MIN = 60_000;

describe('quiz window', () => {
  it('opens 10 minutes before lights out and closes at 30% of a 2 hour race (36 minutes in)', () => {
    expect(quizEarliestOpenMs(START)).toBe(START - 10 * MIN);
    expect(quizLatestCloseMs(START, 120)).toBe(START + 36 * MIN);
    expect(defaultQuizWindow(START, 120)).toEqual({ opensMs: START - 10 * MIN, closesMs: START + 36 * MIN });
  });
  it('scales with the race length', () => {
    expect(quizLatestCloseMs(START, 90)).toBe(START + 27 * MIN);
    expect(quizLatestCloseMs(START, 180)).toBe(START + 54 * MIN);
  });
  it('clamps an early open and a late close, and says why', () => {
    const w = clampQuizWindow(START, 120, START - 60 * MIN, START + 90 * MIN);
    expect(w.opensMs).toBe(START - 10 * MIN);
    expect(w.closesMs).toBe(START + 36 * MIN);
    expect(w.notes).toHaveLength(2);
  });
  it('lets the host open later and close earlier', () => {
    const w = clampQuizWindow(START, 120, START, START + 20 * MIN);
    expect(w).toMatchObject({ opensMs: START, closesMs: START + 20 * MIN, notes: [] });
  });
  it('never returns a window that closes before it opens', () => {
    const w = clampQuizWindow(START, 120, START + 50 * MIN, START + 60 * MIN);
    expect(w.closesMs).toBeGreaterThan(w.opensMs);
    expect(w.closesMs).toBeLessThanOrEqual(quizLatestCloseMs(START, 120));
  });
  it('reports how much further the close may be extended', () => {
    expect(quizExtendRoomMin(START, 120, START + 20 * MIN)).toBe(16);
    expect(quizExtendRoomMin(START, 120, START + 36 * MIN)).toBe(0);
    expect(quizExtendRoomMin(START, 120, START + 50 * MIN)).toBe(0);
  });
  it('isQuizWindowAllowed mirrors the rules', () => {
    const d = defaultQuizWindow(START, 120);
    expect(isQuizWindowAllowed(START, 120, d.opensMs, d.closesMs)).toBe(true);
    expect(isQuizWindowAllowed(START, 120, d.opensMs - 1, d.closesMs)).toBe(false);
    expect(isQuizWindowAllowed(START, 120, d.opensMs, d.closesMs + 1)).toBe(false);
    expect(isQuizWindowAllowed(START, 600, d.opensMs, d.closesMs)).toBe(false); // longer than any real race
    expect(isQuizWindowAllowed(START, 120, d.closesMs, d.closesMs)).toBe(false);
  });
});

describe('live close logic', () => {
  const ts = (ms: number) => ({ toMillis: () => ms });
  const base = { closesAt: ts(START + 36 * MIN), raceStartUtc: ts(START), raceDurationMin: 120, totalLaps: 56 };
  it('closeLap is floor(30%)', () => {
    expect([closeLap(56), closeLap(78), closeLap(44)]).toEqual([16, 23, 13]);
  });
  it('closes by lap before the clock', () => {
    expect(quizCloseReason({ ...base, liveLap: 15 }, START + 10 * MIN)).toBeNull();
    expect(quizCloseReason({ ...base, liveLap: 16 }, START + 10 * MIN)).toBe('lap');
  });
  it('closes by clock, and the host close wins', () => {
    expect(quizCloseReason(base, START + 36 * MIN)).toBe('clock');
    expect(quizCloseReason({ ...base, override: 'closed' }, START)).toBe('override');
  });
  it('a delayed race that has not started does not use up time', () => {
    expect(quizIsClosed({ ...base, delayed: true }, START + 5 * 60 * MIN)).toBe(false);
    expect(quizIsClosed({ ...base, delayed: true, raceStartedAt: ts(START) }, START + 36 * MIN)).toBe(true);
  });
  it('Manual extend past the cap lifts the lap close', () => {
    const c = { ...base, override: 'open' as const, closesAt: ts(START + 50 * MIN), liveLap: 20 };
    expect(quizExtendedPastCap(c)).toBe(true);
    expect(quizIsClosed(c, START + 40 * MIN)).toBe(false);
    expect(quizIsClosed({ ...c, closesAt: ts(START + 30 * MIN) }, START + 10 * MIN)).toBe(true);
  });
  it('lightsOutClosesAtMs leaves a minute of margin; clampLap bounds the lap', () => {
    expect(lightsOutClosesAtMs(START, 120)).toBe(START + 36 * MIN - MIN);
    expect([clampLap(-3, 56), clampLap(99, 56), clampLap(NaN, 56), clampLap(7.4, 56)]).toEqual([0, 56, 0, 7]);
  });
});
