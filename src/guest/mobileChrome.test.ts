import { describe, expect, it } from 'vitest';
import { activeTab, chromeVisible } from './mobileChrome';

describe('chromeVisible', () => {
  it.each(['/', '/events', '/events/abc', '/gallery', '/profile', '/tickets/x', '/nope'])('shows on %s', (p) =>
    expect(chromeVisible(p)).toBe(true),
  );
  it.each(['/host', '/host/', '/host/screen', '/host/settings', '/logout', '/error', '/join/tok', '/play/abc'])('hides on %s', (p) =>
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
