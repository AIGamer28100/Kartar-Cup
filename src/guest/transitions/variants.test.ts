import { describe, expect, it } from 'vitest';
import { forMotionPreference, normalizePath, routeMeta, SWAP_AT, transitionFor } from './variants';

describe('transitionFor', () => {
  it('flag-wipe between ordinary public pages', () => {
    expect(transitionFor('/', '/events', 'PUSH', false)).toEqual({
      kind: 'flag-wipe',
      durationMs: 750,
    });
    expect(transitionFor('/events', '/gallery', 'PUSH', false)?.kind).toBe('flag-wipe');
    expect(transitionFor('/gallery', '/profile', 'PUSH', true)?.kind).toBe('flag-wipe');
  });
  it('pit-lane for checkout and tickets', () => {
    expect(transitionFor('/events', '/events/abc', 'PUSH', false)?.kind).toBe('pit-lane');
    expect(transitionFor('/profile', '/tickets/t1', 'PUSH', false)?.kind).toBe('pit-lane');
  });
  it('lights-out only for the first navigation away from landing', () => {
    expect(transitionFor('/', '/events', 'PUSH', true)).toEqual({
      kind: 'lights-out',
      durationMs: 900,
    });
    expect(transitionFor('/', '/events', 'PUSH', false)?.kind).toBe('flag-wipe');
    expect(transitionFor('/events', '/gallery', 'PUSH', true)?.kind).toBe('flag-wipe');
  });
  it('back/forward is a quick 350ms crossfade, even on first visit', () => {
    expect(transitionFor('/events', '/', 'POP', false)).toEqual({
      kind: 'crossfade',
      durationMs: 350,
    });
    expect(transitionFor('/', '/events', 'POP', true)?.kind).toBe('crossfade');
  });
  it('replace navigations stay quiet', () => {
    expect(transitionFor('/join/x', '/profile', 'REPLACE', false)?.kind).toBe('crossfade');
  });
  it('null when either side is host / excluded', () => {
    for (const p of ['/host', '/host/screen', '/host/settings', '/logout', '/error', '/nope']) {
      expect(transitionFor('/', p, 'PUSH', false)).toBeNull();
      expect(transitionFor(p, '/events', 'PUSH', false)).toBeNull();
      expect(transitionFor('/', p, 'POP', true)).toBeNull();
    }
  });
  it('null for same route, search-only and hash-only changes', () => {
    expect(transitionFor('/events', '/events', 'PUSH', false)).toBeNull();
    expect(transitionFor('/events', '/events?x=1', 'PUSH', false)).toBeNull();
    expect(transitionFor('/events', '/events#sched', 'PUSH', false)).toBeNull();
    expect(transitionFor('/events/', '/events', 'PUSH', false)).toBeNull();
    expect(transitionFor('/events/a', '/events/a?step=2', 'PUSH', false)).toBeNull();
  });
  it('different param on the same pattern is a real navigation', () => {
    expect(transitionFor('/events/a', '/events/b', 'PUSH', false)?.kind).toBe('pit-lane');
  });
  it('ignores search/hash on the from side', () => {
    expect(transitionFor('/?x=1', '/events', 'PUSH', true)?.kind).toBe('lights-out');
  });
});

describe('helpers', () => {
  it('normalizePath', () => {
    expect(normalizePath('/events/?a=1#b')).toBe('/events');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
  it('routeMeta covers public routes only', () => {
    expect(routeMeta('/events')).toMatchObject({
      sector: 'S2',
      label: 'EVENTS',
    });
    expect(routeMeta('/events/x/y')).toBeNull();
    expect(routeMeta('/host')).toBeNull();
    expect(routeMeta('/join/tok')?.title).toBe('Join');
  });
  it('reduced motion collapses to a 150ms crossfade', () => {
    const t = transitionFor('/', '/events', 'PUSH', true)!;
    expect(forMotionPreference(t, true)).toEqual({
      kind: 'reduced',
      durationMs: 150,
    });
    expect(forMotionPreference(t, false)).toBe(t);
  });
  it('swap points are inside the run', () => {
    for (const v of Object.values(SWAP_AT)) {
      expect(v).toBeGreaterThan(0.3);
      expect(v).toBeLessThan(0.8);
    }
  });
});
