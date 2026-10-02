import { describe, expect, it } from 'vitest';
import { accessFor, grantableRoles, inviteRolesFor, newInviteToken, toggleRole } from './roles';

describe('accessFor', () => {
  it('a super admin has everything, with or without any roles', () => {
    const a = accessFor(true, []);
    expect(a).toMatchObject({ isSuperAdmin: true, isAdmin: true, isHost: true, canRunBookings: true, isStaff: true });
  });
  it('an admin is a host and can run bookings, but is not a super admin', () => {
    expect(accessFor(false, ['admin'])).toMatchObject({ isSuperAdmin: false, isAdmin: true, isHost: true, canRunBookings: true });
  });
  it('a host runs the console but not people management', () => {
    expect(accessFor(false, ['host'])).toMatchObject({ isAdmin: false, isHost: true, canRunBookings: true, isStaff: true });
  });
  it('a venue host runs bookings only', () => {
    expect(accessFor(false, ['venue_host'])).toMatchObject({ isHost: false, canRunBookings: true, isStaff: true });
  });
  it('label-only roles and no roles get no host access', () => {
    for (const r of ['marketing', 'social_admin', 'contributor', 'community_member']) {
      expect(accessFor(false, [r]).isStaff).toBe(false);
    }
    expect(accessFor(false, []).isStaff).toBe(false);
  });
  it('ignores unknown role strings rather than trusting them', () => {
    expect(accessFor(false, ['superuser', 'root']).isStaff).toBe(false);
  });
});

describe('grantableRoles', () => {
  it('nobody below admin can grant anything', () => {
    expect(grantableRoles(accessFor(false, ['host']))).toEqual([]);
    expect(grantableRoles(accessFor(false, []))).toEqual([]);
  });
  it('an admin can grant everything except admin', () => {
    const r = grantableRoles(accessFor(false, ['admin']));
    expect(r).not.toContain('admin');
    expect(r).toContain('host');
    expect(r).toHaveLength(6);
  });
  it('a super admin can grant admin too', () => {
    expect(grantableRoles(accessFor(true, []))).toContain('admin');
  });
});

describe('inviteRolesFor', () => {
  it('a host can only invite community members', () => {
    expect(inviteRolesFor(accessFor(false, ['host']))).toEqual(['community_member']);
  });
  it('an admin can invite any link role, never host or admin', () => {
    const r = inviteRolesFor(accessFor(false, ['admin']));
    expect(r).toContain('contributor');
    expect(r).toContain('venue_host');
    expect(r).not.toContain('host');
    expect(r).not.toContain('admin');
  });
  it('everyone else cannot invite', () => {
    expect(inviteRolesFor(accessFor(false, ['venue_host']))).toEqual([]);
    expect(inviteRolesFor(accessFor(false, ['marketing']))).toEqual([]);
  });
});

describe('toggleRole', () => {
  it('adds and removes while keeping the others, in a stable order', () => {
    expect(toggleRole(['marketing'], 'host', true)).toEqual(['host', 'marketing']);
    expect(toggleRole(['host', 'marketing'], 'host', false)).toEqual(['marketing']);
    expect(toggleRole([], 'host', false)).toEqual([]);
  });
  it('drops unknown roles it finds', () => {
    expect(toggleRole(['bogus', 'host'], 'marketing', true)).toEqual(['host', 'marketing']);
  });
});

describe('newInviteToken', () => {
  it('is 32 URL-safe characters and different every time', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const t = newInviteToken();
      expect(t).toMatch(/^[A-Za-z0-9]{32}$/);
      seen.add(t);
    }
    expect(seen.size).toBe(200);
  });
  it('is long enough for the rules (>= 24 chars)', () => {
    expect(newInviteToken().length).toBeGreaterThanOrEqual(24);
  });
});
