import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { quizControlState, type QuizControlInput } from './quizControls';

const MIN = 60_000;
const START = 1_000_000_000_000;
const ts = (ms: number) => Timestamp.fromMillis(ms);
// 90 min race: latest close = START + 27 min. closesAt defaults to START + 20 min (7 min of room).
const cfg = (over: Partial<QuizControlInput> = {}): QuizControlInput => ({
  opensAt: ts(START - 10 * MIN),
  closesAt: ts(START + 20 * MIN),
  override: 'none',
  winnerRevealed: false,
  raceStartUtc: ts(START),
  raceDurationMin: 90,
  ...over,
});

describe('quizControlState', () => {
  it('scored has no primary action', () => {
    const s = quizControlState(cfg({ winnerRevealed: true }), START);
    expect(s.status).toBe('scored');
    expect(s.primary.kind).toBe('none');
  });
  it('open offers Close entries -> override closed', () => {
    expect(quizControlState(cfg(), START).primary).toMatchObject({
      kind: 'close',
      label: 'Close entries',
      disabled: false,
      action: { type: 'override', value: 'closed' },
    });
  });
  it('Auto: Open now is locked before the 10-minute mark, with the IST time', () => {
    const s = quizControlState(cfg({ opensAt: ts(START - 5 * MIN) }), START - 11 * MIN, 'auto');
    expect(s.status).toBe('scheduled');
    expect(s.primary).toMatchObject({ kind: 'open', label: 'Open now', disabled: true });
    expect(s.primary.reason).toMatch(/^Auto mode opens the quiz 10 minutes before lights out \(\d\d:\d\d IST\)\./);
  });
  it('Auto: Open now is enabled from the 10-minute mark', () => {
    const s = quizControlState(cfg({ opensAt: ts(START - 5 * MIN) }), START - 10 * MIN, 'auto');
    expect(s.primary).toMatchObject({ kind: 'open', disabled: false, action: { type: 'override', value: 'open' } });
  });
  it('Manual: Open now works any time', () => {
    const s = quizControlState(cfg({ opensAt: ts(START - 5 * MIN) }), START - 2 * 24 * 60 * MIN, 'manual');
    expect(s.primary).toMatchObject({ kind: 'open', disabled: false, action: { type: 'override', value: 'open' } });
  });
  it('Manual is the default mode', () => {
    expect(quizControlState(cfg({ opensAt: ts(START - 5 * MIN) }), START - 11 * MIN).primary.disabled).toBe(false);
  });
  it('closed by host reopens by clearing the override', () => {
    const s = quizControlState(cfg({ override: 'closed' }), START + MIN);
    expect(s.primary).toMatchObject({ kind: 'reopen', label: 'Reopen entries', disabled: false, action: { type: 'override', value: 'none' } });
    expect(s.canClearOverride).toBe(true);
  });
  it('Auto: closed by clock extends 5 min, capped', () => {
    const s = quizControlState(cfg(), START + 21 * MIN, 'auto');
    expect(s.status).toBe('closed');
    expect(s.primary).toMatchObject({
      label: 'Reopen for 5 more min',
      disabled: false,
      action: { type: 'extend', minutes: 5, uncapped: false },
    });
  });
  it('Auto: at the 30% cap the reopen is disabled', () => {
    const s = quizControlState(cfg({ closesAt: ts(START + 27 * MIN) }), START + 28 * MIN, 'auto');
    expect(s.primary.disabled).toBe(true);
    expect(s.primary.reason).toBe('The quiz is already at 30% of the race');
    expect(s.extendRoomMin).toBe(0);
  });
  it('Manual: at the 30% cap the reopen still works, uncapped', () => {
    const s = quizControlState(cfg({ closesAt: ts(START + 27 * MIN) }), START + 28 * MIN, 'manual');
    expect(s.extendUncapped).toBe(true);
    expect(s.primary).toMatchObject({ disabled: false, action: { type: 'extend', minutes: 5, uncapped: true } });
  });
  it('closed by lap is disabled and points at Race progress', () => {
    const s = quizControlState(cfg({ totalLaps: 56, liveLap: 16 }), START + MIN);
    expect(s.primary).toMatchObject({ kind: 'reopen', disabled: true });
    expect(s.primary.reason).toBe('Closed at lap 16: if the lap was a typo, correct it in Race progress');
    expect(s.primary.action).toBeUndefined();
  });
  it('clear override is only available when an override is set', () => {
    expect(quizControlState(cfg(), START).canClearOverride).toBe(false);
    expect(quizControlState(cfg({ override: 'open' }), START).canClearOverride).toBe(true);
  });
});
