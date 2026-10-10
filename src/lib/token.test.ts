import { describe, expect, it } from 'vitest';
import { randomToken } from './token';

describe('randomToken', () => {
  it('is base62 of the asked length', () => {
    for (const n of [1, 24, 32, 100]) expect(randomToken(n)).toMatch(new RegExp(`^[A-Za-z0-9]{${n}}$`));
  });
  it('does not repeat', () => {
    expect(new Set(Array.from({ length: 200 }, () => randomToken(24))).size).toBe(200);
  });
});
