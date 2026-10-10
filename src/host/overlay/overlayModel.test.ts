import { describe, expect, it } from 'vitest';
import {
  SIZE_PRESETS,
  formatClock,
  hasResults,
  isOverlaySize,
  overlayClock,
  popupFeatures,
  selectStyleCopies,
  shortJoinUrl,
  topStandings,
  type StyleNodeLike,
} from './overlayModel';
import type { RankedRow } from '../../lib/types';

const node = (tagName: string, attrs: Record<string, string> = {}, extra: Partial<StyleNodeLike> = {}): StyleNodeLike => ({
  tagName,
  textContent: null,
  getAttribute: (n) => attrs[n] ?? null,
  ...extra,
});

describe('overlayModel', () => {
  it('formats the clock', () => {
    expect(formatClock(-5000)).toBe('00:00');
    expect(formatClock(14 * 60_000 + 32_000)).toBe('14:32');
    expect(formatClock(3_723_000)).toBe('1:02:03');
    expect(formatClock((2 * 86400 + 4 * 3600) * 1000)).toBe('2d 04h');
  });

  it('picks the clock phrase per status', () => {
    expect(overlayClock('open', 0, 90_000, 0)).toEqual({ label: 'Closes in', value: '01:30', counting: true });
    expect(overlayClock('scheduled', 60_000, 0, 0).label).toBe('Opens in');
    expect(overlayClock('closed', 0, 0, 0)).toMatchObject({ value: 'Closed', counting: false });
    expect(overlayClock('scored', 0, 0, 0).value).toBe('Winner revealed');
  });

  it('shortens join urls and sizes popups', () => {
    expect(shortJoinUrl('https://www.kartar-cup.web.app/play/abc/')).toBe('kartar-cup.web.app/play/abc');
    expect(popupFeatures('compact')).toBe('popup,width=380,height=260');
    expect(isOverlaySize('wide') && !isOverlaySize('x')).toBe(true);
    expect(SIZE_PRESETS.wide.width).toBe(640);
  });

  it('detects results and slices standings', () => {
    expect(hasResults(null)).toBe(false);
    expect(hasResults({ q1: [] })).toBe(false);
    expect(hasResults({ q1: [], q2: ['a'] })).toBe(true);
    const rows = Array.from({ length: 8 }, (_, i) => ({ uid: String(i) }) as RankedRow);
    expect(topStandings(rows)).toHaveLength(5);
    expect(topStandings(rows, -1)).toHaveLength(0);
  });

  it('copies only enabled, non-alternate stylesheets', () => {
    const out = selectStyleCopies([
      node('LINK', { rel: 'stylesheet', href: '/a.css', media: 'screen' }, { href: 'http://x/a.css' }),
      node('LINK', { rel: 'alternate stylesheet', href: '/b.css' }),
      node('LINK', { rel: 'icon', href: '/i.png' }),
      node('LINK', { rel: 'stylesheet', href: '/c.css' }, { disabled: true }),
      node('STYLE', {}, { textContent: 'a{}' }),
      node('STYLE', {}, { textContent: '  ' }),
    ]);
    expect(out).toEqual([
      { kind: 'link', href: 'http://x/a.css', media: 'screen' },
      { kind: 'style', css: 'a{}', media: null },
    ]);
  });
});
