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
});
