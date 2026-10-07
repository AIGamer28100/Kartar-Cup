import { describe, expect, it } from 'vitest';
import { decideRoute, isHostPath } from './routing';

const base = { user: false, isHost: undefined, loading: false } as const;

describe('isHostPath', () => {
  it('matches host routes only', () => {
    expect(isHostPath('/host')).toBe(true);
    expect(isHostPath('/host/settings')).toBe(true);
    expect(isHostPath('/hostile')).toBe(false);
    expect(isHostPath('/')).toBe(false);
  });
});

describe('decideRoute', () => {
  it('waits while auth resolves on host routes', () => {
    expect(decideRoute({ ...base, path: '/host', loading: true })).toEqual({ kind: 'loading' });
    expect(decideRoute({ ...base, path: '/host/settings', loading: true })).toEqual({ kind: 'loading' });
  });
  it('signed-out host visits are redirected to /', () => {
    expect(decideRoute({ ...base, path: '/host' })).toEqual({ kind: 'redirect', to: '/' });
    expect(decideRoute({ ...base, path: '/host/settings' })).toEqual({ kind: 'redirect', to: '/' });
  });
  it('shows loading while the host lookup resolves, never host UI', () => {
    expect(decideRoute({ ...base, path: '/host', user: true })).toEqual({ kind: 'loading' });
  });
  it('bounces guests off host routes and lets hosts in', () => {
    expect(decideRoute({ ...base, path: '/host', user: true, isHost: false })).toEqual({ kind: 'redirect', to: '/' });
    expect(decideRoute({ ...base, path: '/host/settings', user: true, isHost: false })).toEqual({
      kind: 'redirect',
      to: '/',
    });
    expect(decideRoute({ ...base, path: '/host', user: true, isHost: true })).toEqual({ kind: 'render' });
    expect(decideRoute({ ...base, path: '/host/settings', user: true, isHost: true })).toEqual({ kind: 'render' });
  });
  it('public routes always render', () => {
    expect(decideRoute({ ...base, path: '/', loading: true })).toEqual({ kind: 'render' });
    expect(decideRoute({ ...base, path: '/logout' })).toEqual({ kind: 'render' });
  });
});
