import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import LiveOverlay, { type LiveOverlayProps } from './LiveOverlay';

const ts = (ms: number) => ({ toMillis: () => ms }) as never;
const NOW = 1_000_000_000_000;
const base: LiveOverlayProps = {
  loading: false,
  error: null,
  quiz: { name: 'Monaco Quiz', opensAt: ts(NOW - 60_000), closesAt: ts(NOW + 125_000), override: null, winnerRevealed: false } as never,
  joinUrl: 'https://www.kartarcup.com/play/abc123/',
  quizTabHref: '/host/events/e1',
  nowMs: NOW,
};
const html = (p: Partial<LiveOverlayProps> = {}) => renderToStaticMarkup(createElement(LiveOverlay, { ...base, ...p }));

describe('LiveOverlay', () => {
  it('error wins over loading and shows the message', () => {
    const h = html({ error: 'permission-denied', loading: true });
    expect(h).toContain('Live feed lost');
    expect(h).toContain('permission-denied');
  });

  it('shows the connecting skeleton while loading', () => {
    const h = html({ loading: true });
    expect(h).toContain('Connecting');
    expect(h).toContain('aria-busy="true"');
  });

  it('shows "No live quiz" when no quiz', () => {
    expect(html({ quiz: null })).toContain('No live quiz');
  });

  it('open quiz: only the QR and the countdown under it (no join text, name or counts)', () => {
    const h = html();
    expect(h).toContain('Closes in');
    expect(h).toContain('02:05');
    expect(h).not.toContain('Scan or visit');
    expect(h).not.toContain('Players in');
    expect(h).not.toContain('>Monaco Quiz<');
  });

  it('no join link: shows create-link prompt pointing at the Quiz tab (new tab without onQuizTab)', () => {
    const h = html({ joinUrl: null });
    expect(h).toContain('No join link yet');
    expect(h).toContain('href="/host/events/e1"');
    expect(h).toContain('target="_blank"');
  });

  it('PiP mode (onQuizTab) does not open a new tab', () => {
    expect(html({ joinUrl: null, onQuizTab: () => {} })).not.toContain('target="_blank"');
  });

  it('before opening: opens-in countdown', () => {
    const h = html({ quiz: { ...base.quiz!, opensAt: ts(NOW + 3_600_000 * 2 + 5_000), closesAt: ts(NOW + 9e9) } as never });
    expect(h).toContain('Opens in');
  });
});
