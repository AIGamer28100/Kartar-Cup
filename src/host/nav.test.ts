import { describe, expect, it } from 'vitest';
import { matchPath } from 'react-router';
import { HOST_NAV, HOST_ROUTE_TABLE, QUIZ_TABS, QUIZ_RESULTS, CONTENT_TABS, SECTION, quizPath, visibleNav } from './nav';

const abs = (p: string) => (p ? `/host/${p}` : '/host');
const served = HOST_ROUTE_TABLE.filter((r) => !r.redirectTo);
const resolves = (to: string) => HOST_ROUTE_TABLE.some((r) => matchPath({ path: abs(r.path), end: true }, to));

describe('host nav <-> routes', () => {
  it('every nav item resolves to a route', () => {
    for (const n of HOST_NAV) expect(resolves(n.to), n.to).toBe(true);
  });

  it('every served top-level section has a nav item (or is the More page / a standalone window)', () => {
    const navTos = new Set(HOST_NAV.map((n) => n.to));
    for (const r of served) {
      const [seg] = r.path.split('/');
      if (seg === SECTION.more || r.standalone) continue;
      expect(navTos.has(abs(seg)), r.path).toBe(true);
    }
  });

  it('every tab has its own route and redirects point at real routes', () => {
    for (const t of QUIZ_TABS) expect(resolves(quizPath('ev1', t.id)), t.id).toBe(true);
    expect(resolves(quizPath('ev1', QUIZ_RESULTS.id))).toBe(true);
    for (const t of CONTENT_TABS) expect(resolves(`/host/content/${t.id}`)).toBe(true);
    for (const r of HOST_ROUTE_TABLE.filter((x) => x.redirectTo !== undefined && !x.path.endsWith('/*'))) {
      expect(
        resolves(abs(r.redirectTo!).replace(':eventId', 'ev1')) || r.redirectTo === '',
        `${r.path} -> ${r.redirectTo}`,
      ).toBe(true);
    }
  });

  it('keeps the legacy URLs as redirects', () => {
    expect(HOST_ROUTE_TABLE).toContainEqual({ path: 'activity', redirectTo: 'audit-log' });
    expect(HOST_ROUTE_TABLE).toContainEqual({ path: 'cup', redirectTo: 'league' });
    expect(HOST_ROUTE_TABLE).toContainEqual({ path: 'settings/*', redirectTo: 'bookings' });
  });

  it('has unique nav targets and Audit log last', () => {
    expect(new Set(HOST_NAV.map((n) => n.to)).size).toBe(HOST_NAV.length);
    expect(HOST_NAV[HOST_NAV.length - 1].label).toBe('Audit log');
  });

  it('does not widen access: venue_host sees only Bookings and Check-in', () => {
    expect(visibleNav(false).map((n) => n.label)).toEqual(['Bookings', 'Check-in']);
    expect(visibleNav(true)).toHaveLength(HOST_NAV.length);
  });
});
