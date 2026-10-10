import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { deriveStatus } from './eventStatus';

const T = 1_000_000_000_000;
const cfg = (over: Record<string, unknown> = {}) => ({
  opensAt: Timestamp.fromMillis(T),
  closesAt: Timestamp.fromMillis(T + 81 * 60_000),
  override: 'none' as const,
  winnerRevealed: false,
  ...over,
});

describe('deriveStatus', () => {
  it('scheduled before opensAt', () => expect(deriveStatus(cfg(), T - 1)).toBe('scheduled'));
  it('open at opensAt', () => expect(deriveStatus(cfg(), T)).toBe('open'));
  it('open just before closesAt', () => expect(deriveStatus(cfg(), T + 81 * 60_000 - 1)).toBe('open'));
  it('closed at closesAt', () => expect(deriveStatus(cfg(), T + 81 * 60_000)).toBe('closed'));
  it('override open before opensAt', () => expect(deriveStatus(cfg({ override: 'open' }), T - 5000)).toBe('open'));
  it('override open cannot pass closesAt', () =>
    expect(deriveStatus(cfg({ override: 'open' }), T + 82 * 60_000)).toBe('closed'));
  it('override closed wins in window', () => expect(deriveStatus(cfg({ override: 'closed' }), T + 1)).toBe('closed'));
  it('scored when revealed', () => expect(deriveStatus(cfg({ winnerRevealed: true }), T + 1)).toBe('scored'));

  describe('override open at any time', () => {
    const START = T + 30 * 60_000;
    it('override open 2 days before the start is open', () =>
      expect(
        deriveStatus(cfg({ override: 'open', opensAt: Timestamp.fromMillis(START), closesAt: Timestamp.fromMillis(START + 81 * 60_000) }), START - 2 * 86_400_000),
      ).toBe('open'));
  });

  describe('live quiz clock', () => {
    const CLOSE = T + 81 * 60_000;
    it('closes by lap before the clock', () => {
      expect(deriveStatus(cfg({ totalLaps: 56, liveLap: 15 }), T + 1)).toBe('open');
      expect(deriveStatus(cfg({ totalLaps: 56, liveLap: 16 }), T + 1)).toBe('closed');
    });
    it('falls back to the clock when the lap is unknown', () => {
      expect(deriveStatus(cfg({ totalLaps: 56 }), CLOSE - 1)).toBe('open');
      expect(deriveStatus(cfg({ totalLaps: 56 }), CLOSE)).toBe('closed');
    });
    it('falls back to the clock when the total laps are unknown', () =>
      expect(deriveStatus(cfg({ liveLap: 40 }), CLOSE - 1)).toBe('open'));
    it('delayed and not started stays open past closesAt', () =>
      expect(deriveStatus(cfg({ delayed: true }), CLOSE + 60 * 60_000)).toBe('open'));
    it('delayed still closes by lap or override', () => {
      expect(deriveStatus(cfg({ delayed: true, totalLaps: 44, liveLap: 13 }), T + 1)).toBe('closed');
      expect(deriveStatus(cfg({ delayed: true, override: 'closed' }), T + 1)).toBe('closed');
    });
    it('delayed after the start does nothing', () =>
      expect(deriveStatus(cfg({ delayed: true, raceStartedAt: Timestamp.fromMillis(T) }), CLOSE)).toBe('closed'));
    it('scored still wins over a lap close', () =>
      expect(deriveStatus(cfg({ winnerRevealed: true, totalLaps: 56, liveLap: 30 }), T + 1)).toBe('scored'));
  });
});
