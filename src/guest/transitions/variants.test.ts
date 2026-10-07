import { describe, expect, it } from 'vitest';
import {
  forMotionPreference,
  MAX_HOLD_MS,
  normalizePath,
  PAGE_BUDGET_MS,
  routeMeta,
  routeOrder,
  sweepDir,
  TIMING,
  transitionFor,
} from './variants';

describe('transitionFor', () => {
  it('kerb-sweep between ordinary public pages', () => {
    expect(transitionFor('/', '/events', 'PUSH', false)).toEqual({
      kind: 'kerb-sweep',
      coverMs: 200,
      revealMs: 230,
      durationMs: 430,
      dir: 1,
    });
    expect(transitionFor('/events', '/gallery', 'PUSH', false)?.kind).toBe('kerb-sweep');
    expect(transitionFor('/gallery', '/profile', 'PUSH', true)?.kind).toBe('kerb-sweep');
  });
  it('sweep direction follows the running order', () => {
    expect(transitionFor('/events', '/gallery', 'PUSH', false)?.dir).toBe(1);
    expect(transitionFor('/contact', '/events', 'PUSH', false)?.dir).toBe(-1);
  });
  it('chequered into a race weekend page', () => {
    expect(transitionFor('/events', '/races/2026-r17-singapore', 'PUSH', false)).toMatchObject({ kind: 'chequered', dir: 1 });
    expect(transitionFor('/contact', '/races/x', 'PUSH', false)).toMatchObject({ kind: 'chequered', dir: -1 });
  });
  it('pit-lane for checkout and tickets', () => {
    expect(transitionFor('/events', '/events/abc', 'PUSH', false)?.kind).toBe('pit-lane');
    expect(transitionFor('/profile', '/tickets/t1', 'PUSH', false)?.kind).toBe('pit-lane');
  });
  it('lights-out only for the first navigation away from landing', () => {
    expect(transitionFor('/', '/events', 'PUSH', true)).toMatchObject({ kind: 'lights-out', durationMs: 440 });
    expect(transitionFor('/', '/events', 'PUSH', false)?.kind).toBe('kerb-sweep');
    expect(transitionFor('/events', '/gallery', 'PUSH', true)?.kind).toBe('kerb-sweep');
  });
  it('back/forward is a quick crossfade, even on first visit', () => {
    expect(transitionFor('/events', '/', 'POP', false)).toMatchObject({ kind: 'crossfade', dir: -1, durationMs: 280 });
    expect(transitionFor('/', '/events', 'POP', true)?.kind).toBe('crossfade');
  });
  it('replace navigations stay quiet', () => {
    expect(transitionFor('/join/x', '/profile', 'REPLACE', false)).toMatchObject({ kind: 'crossfade', dir: 1 });
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

describe('timing budget', () => {
  it('every transition fits the 450ms page budget', () => {
    for (const [kind, t] of Object.entries(TIMING)) {
      expect(t.coverMs + t.revealMs, kind).toBeLessThanOrEqual(PAGE_BUDGET_MS);
      expect(t.coverMs).toBeGreaterThan(0);
      expect(t.revealMs).toBeGreaterThan(0);
    }
  });
  it('the loading hold is bounded', () => {
    expect(MAX_HOLD_MS).toBeGreaterThan(0);
    expect(MAX_HOLD_MS).toBeLessThanOrEqual(2000);
  });
});

describe('helpers', () => {
  it('normalizePath', () => {
    expect(normalizePath('/events/?a=1#b')).toBe('/events');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('')).toBe('/');
  });
  it('routeOrder and sweepDir', () => {
    expect(routeOrder('/')).toBe(0);
    expect(routeOrder('/events/abc')).toBe(routeOrder('/events'));
    expect(routeOrder('/nowhere')).toBeGreaterThan(routeOrder('/join/x'));
    expect(sweepDir('/events', '/events/abc')).toBe(1);
    expect(sweepDir('/events/abc', '/events')).toBe(-1);
    expect(sweepDir('/about', '/')).toBe(-1);
  });
  it('routeMeta covers public routes only', () => {
    expect(routeMeta('/events')).toMatchObject({
      sector: 'S2',
      label: 'EVENTS',
    });
    expect(routeMeta('/about')?.label).toBe('ABOUT');
    expect(routeMeta('/cup')).toMatchObject({ label: 'CUP', title: 'Karter Cup' });
    expect(transitionFor('/', '/cup', 'PUSH', false)?.kind).toBe('kerb-sweep');
    expect(routeMeta('/contact')?.title).toBe('Contact');
    expect(routeMeta('/events/x/y')).toBeNull();
    expect(routeMeta('/host')).toBeNull();
    expect(routeMeta('/join/tok')?.title).toBe('Join');
  });
  it('reduced motion collapses to a short opacity-only fade', () => {
    const t = transitionFor('/', '/events', 'PUSH', true)!;
    expect(forMotionPreference(t, true)).toMatchObject({ kind: 'reduced', durationMs: 150 });
    expect(forMotionPreference(t, false)).toBe(t);
  });
});
