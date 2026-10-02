import { describe, expect, it } from 'vitest';
import { activeTab, chromeVisible, predictEnabled, predictHint, stripCopy, STRIP_LEAD_MS, STRIP_LOCKED_MS } from './mobileChrome';

describe('chromeVisible', () => {
  it.each(['/', '/events', '/events/abc', '/gallery', '/profile', '/tickets/x', '/nope'])('shows on %s', (p) =>
    expect(chromeVisible(p)).toBe(true),
  );
  it.each(['/host', '/host/', '/host/screen', '/host/settings', '/logout', '/error', '/join/tok'])('hides on %s', (p) =>
    expect(chromeVisible(p)).toBe(false),
  );
  it('matches whole segments only', () => {
    expect(chromeVisible('/hostel')).toBe(true);
    expect(chromeVisible('/events?x=/host')).toBe(true);
  });
});

describe('activeTab', () => {
  it('maps paths to tabs', () => {
    expect(activeTab('/')).toBe('home');
    expect(activeTab('/events')).toBe('events');
    expect(activeTab('/events/abc')).toBe('events');
    expect(activeTab('/profile')).toBe('profile');
    expect(activeTab('/tickets/1')).toBe('profile');
    expect(activeTab('/gallery')).toBeNull();
    expect(activeTab('/zzz')).toBeNull();
  });
});

describe('predict gate', () => {
  it('is enabled only while open', () => {
    expect(predictEnabled('open')).toBe(true);
    for (const s of ['scheduled', 'closed', 'scored', null, undefined] as const) expect(predictEnabled(s)).toBe(false);
  });
  it('explains why it is off', () => {
    expect(predictHint('scheduled')).toMatch(/lights-out/);
    expect(predictHint('closed')).toMatch(/closed/);
    expect(predictHint(null)).toMatch(/No race/);
  });
});

describe('stripCopy', () => {
  const now = 1_000_000_000;
  it('scheduled within the lead window counts down', () => {
    const c = stripCopy('scheduled', now + 90_000, now)!;
    expect(c.kind).toBe('scheduled');
    expect(c.time).toBe('01:30');
  });
  it('scheduled switches to d/h for long waits and hides beyond the lead window', () => {
    expect(stripCopy('scheduled', now + 30 * 3600_000, now)!.time).toBe('1d 6h');
    expect(stripCopy('scheduled', now + STRIP_LEAD_MS + 1, now)).toBeNull();
  });
  it('open shows closes-in', () => {
    const c = stripCopy('open', now + 125_000, now)!;
    expect(c.label).toMatch(/Predictions open/);
    expect(c.time).toBe('02:05');
  });
  it('closed shows locked, then fades out', () => {
    const c = stripCopy('closed', now - 1000, now)!;
    expect(c.label).toBe('Predictions locked');
    expect(c.time).toBeNull();
    expect(stripCopy('closed', now - STRIP_LOCKED_MS - 1, now)).toBeNull();
  });
  it('scored and no event hide', () => {
    expect(stripCopy('scored', now, now)).toBeNull();
    expect(stripCopy(null, now, now)).toBeNull();
  });
});
