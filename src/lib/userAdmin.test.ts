import { describe, expect, it } from 'vitest';
import { filterUsers, inviteLink, inviteStatus, removesOwnLastAdmin } from './userAdmin';

const users = [
  { uid: '1', email: 'ann@x.com', name: 'Ann Lee', roles: ['host'] },
  { uid: '2', email: 'bob@y.com', name: 'Bob', roles: [] },
  { uid: '3', email: 'cy@x.com', name: 'Cy', roles: ['host', 'marketing'] },
];

describe('filterUsers', () => {
  it('returns everyone with no filters', () => expect(filterUsers(users, '  ', '')).toHaveLength(3));
  it('searches name and email case-insensitively', () => {
    expect(filterUsers(users, 'ANN', '').map((u) => u.uid)).toEqual(['1']);
    expect(filterUsers(users, '@x.com', '').map((u) => u.uid)).toEqual(['1', '3']);
  });
  it('filters by role and by no role', () => {
    expect(filterUsers(users, '', 'marketing').map((u) => u.uid)).toEqual(['3']);
    expect(filterUsers(users, '', 'none').map((u) => u.uid)).toEqual(['2']);
  });
  it('combines search and role', () => expect(filterUsers(users, 'cy', 'host').map((u) => u.uid)).toEqual(['3']));
});

describe('removesOwnLastAdmin', () => {
  const base = { isSelf: true, isSuperAdmin: false, before: ['admin', 'host'], after: ['host'] };
  it('blocks stripping own admin', () => expect(removesOwnLastAdmin(base)).toBe(true));
  it('allows it for other people', () => expect(removesOwnLastAdmin({ ...base, isSelf: false })).toBe(false));
  it('allows it for super admins', () => expect(removesOwnLastAdmin({ ...base, isSuperAdmin: true })).toBe(false));
  it('allows unrelated changes', () => expect(removesOwnLastAdmin({ ...base, after: ['admin'] })).toBe(false));
});

describe('inviteStatus', () => {
  const at = (ms: number) => ({ toMillis: () => ms });
  it('active, expired, revoked', () => {
    expect(inviteStatus({ active: true, expiresAt: at(2000) }, 1000)).toBe('active');
    expect(inviteStatus({ active: true, expiresAt: at(1000) }, 1000)).toBe('expired');
    expect(inviteStatus({ active: false, expiresAt: at(9000) }, 1000)).toBe('revoked');
  });
});

describe('inviteLink', () => {
  it('joins origin and join path', () => expect(inviteLink('https://a.b', 'tok')).toBe('https://a.b/join/tok'));
});
