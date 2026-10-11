import { describe, expect, it } from 'vitest';
import { buildDescription, buildTitle, DEFAULT_DESCRIPTION } from './pageMeta';

describe('buildTitle', () => {
  it('suffixes the site name', () => expect(buildTitle('Events')).toBe('Events | Kartar CUP'));
  it('falls back to the site name', () => {
    expect(buildTitle()).toBe('Kartar CUP');
    expect(buildTitle('  ')).toBe('Kartar CUP');
    expect(buildTitle('kartar cup')).toBe('Kartar CUP');
  });
});

describe('buildDescription', () => {
  it('defaults when empty', () => {
    expect(buildDescription()).toBe(DEFAULT_DESCRIPTION);
    expect(buildDescription('   ')).toBe(DEFAULT_DESCRIPTION);
  });
  it('collapses whitespace', () => expect(buildDescription('a \n  b')).toBe('a b'));
  it('truncates long text to <=160 chars with an ellipsis', () => {
    const out = buildDescription('word '.repeat(80));
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
  });
});
