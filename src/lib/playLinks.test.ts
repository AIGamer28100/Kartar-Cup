import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => ({ auth: {}, db: {} }));

import { isPlayToken, playPath, playUrl } from './playLinks';

describe('playLinks', () => {
  it('builds /play/<token> links', () => {
    expect(playPath('abc')).toBe('/play/abc');
    expect(playUrl('abc', 'https://x.test')).toBe('https://x.test/play/abc');
  });
  it('accepts only 24 base62 characters', () => {
    expect(isPlayToken('e2eQuizToken01234567890A')).toBe(true);
    expect(isPlayToken('short')).toBe(false);
    expect(isPlayToken('e2eQuizToken0123456789-A!')).toBe(false);
  });
});
