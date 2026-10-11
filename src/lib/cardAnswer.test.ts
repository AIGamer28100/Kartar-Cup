import { describe, expect, it } from 'vitest';
import { formatCardAnswer, parseCardAnswer } from './cardAnswer';

describe('card answer', () => {
  it('round-trips a valid answer', () => {
    expect(parseCardAnswer(formatCardAnswer('norris', 42))).toEqual({ driverId: 'norris', points: 42 });
    expect(parseCardAnswer('norris:0')).toEqual({ driverId: 'norris', points: 0 });
    expect(parseCardAnswer('norris:999')?.points).toBe(999);
  });
  it('rejects bad input', () => {
    for (const s of ['norris:1000', 'norris:-1', 'norris:1.5', 'norris:', 'norris', ':5', 'norris:x', '', undefined]) {
      expect(parseCardAnswer(s)).toBeNull();
    }
  });
});
