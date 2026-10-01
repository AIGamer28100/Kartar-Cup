import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const tok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const as = (uid: string, email: string) => env.authenticatedContext(uid, tok(email)).firestore();

const SUPER = () => as('s1', 'super@x.com'); // hosts/ doc: console-created super admin
const ADMIN = () => as('a1', 'admin@x.com');
const HOST = () => as('h1', 'host@x.com');
const VENUE = () => as('v1', 'venue@x.com');
const MARKETER = () => as('m1', 'mkt@x.com');
const GUEST = () => as('g1', 'guest@x.com');
const NEWBIE = () => as('n1', 'new@x.com'); // signed in, no users doc yet

const userDoc = (uid: string, email: string, roles: string[] = []) => ({
  uid, email, name: email.split('@')[0], createdAt: Timestamp.now(), lastSeenAt: Timestamp.now(), roles,
});

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'hosts/super@x.com'), { role: 'super' });
    await setDoc(doc(db, 'users/s1'), userDoc('s1', 'super@x.com'));
    await setDoc(doc(db, 'users/a1'), userDoc('a1', 'admin@x.com', ['admin']));
    await setDoc(doc(db, 'users/h1'), userDoc('h1', 'host@x.com', ['host']));
    await setDoc(doc(db, 'users/v1'), userDoc('v1', 'venue@x.com', ['venue_host']));
    await setDoc(doc(db, 'users/m1'), userDoc('m1', 'mkt@x.com', ['marketing']));
    await setDoc(doc(db, 'users/g1'), userDoc('g1', 'guest@x.com'));
  });
}
async function seedInvite(token: string, over: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'invites/' + token), {
      role: 'community_member', createdBy: 'host@x.com', createdAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 864e5), active: true, ...over,
    });
  });
}
const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345'; // 32 chars

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-roles-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe('creating your own profile', () => {
  it('a new user creates their own record with no roles', async () => {
    await assertSucceeds(setDoc(doc(NEWBIE(), 'users/n1'), {
      uid: 'n1', email: 'new@x.com', name: 'New', createdAt: serverTimestamp(), lastSeenAt: serverTimestamp(), roles: [],
    }));
  });
  it('cannot create a record already holding a role (self-promotion)', async () => {
    await assertFails(setDoc(doc(NEWBIE(), 'users/n1'), {
      uid: 'n1', email: 'new@x.com', name: 'New', createdAt: serverTimestamp(), lastSeenAt: serverTimestamp(), roles: ['admin'],
    }));
  });
  it('cannot create a record for someone else', async () => {
    await assertFails(setDoc(doc(NEWBIE(), 'users/other'), {
      uid: 'other', email: 'new@x.com', name: 'New', createdAt: serverTimestamp(), lastSeenAt: serverTimestamp(), roles: [],
    }));
  });
  it('cannot claim a different email', async () => {
    await assertFails(setDoc(doc(NEWBIE(), 'users/n1'), {
      uid: 'n1', email: 'someone.else@x.com', name: 'New', createdAt: serverTimestamp(), lastSeenAt: serverTimestamp(), roles: [],
    }));
  });
});

describe('editing your own profile', () => {
  it('can update name and last-seen', async () => {
    await assertSucceeds(updateDoc(doc(GUEST(), 'users/g1'), { name: 'Renamed', lastSeenAt: serverTimestamp() }));
  });
  it('can NOT write your own roles', async () => {
    await assertFails(updateDoc(doc(GUEST(), 'users/g1'), { roles: ['admin'] }));
    await assertFails(updateDoc(doc(GUEST(), 'users/g1'), { roles: ['host'], lastSeenAt: serverTimestamp() }));
  });
  it('even an admin cannot change their own roles', async () => {
    await assertFails(updateDoc(doc(ADMIN(), 'users/a1'), {
      roles: ['admin', 'host'], roleUpdatedBy: 'admin@x.com', roleUpdatedAt: serverTimestamp(),
    }));
  });
});

describe('reading the directory', () => {
  it('a guest reads only their own record', async () => {
    await assertSucceeds(getDoc(doc(GUEST(), 'users/g1')));
    await assertFails(getDoc(doc(GUEST(), 'users/h1')));
  });
  it('a guest cannot list everyone', async () => {
    await assertFails(getDocs(collection(GUEST(), 'users')));
  });
  it('a plain host cannot list everyone either', async () => {
    await assertFails(getDocs(collection(HOST(), 'users')));
  });
  it('an admin and a super admin can list everyone', async () => {
    await assertSucceeds(getDocs(collection(ADMIN(), 'users')));
    await assertSucceeds(getDocs(collection(SUPER(), 'users')));
  });
});

describe('admins managing roles', () => {
  const edit = (roles: string[], by = 'admin@x.com') => ({ roles, roleUpdatedBy: by, roleUpdatedAt: serverTimestamp() });

  it('an admin can make someone a host', async () => {
    await assertSucceeds(updateDoc(doc(ADMIN(), 'users/g1'), edit(['host'])));
  });
  it('an admin can remove a host', async () => {
    await assertSucceeds(updateDoc(doc(ADMIN(), 'users/h1'), edit([])));
  });
  it('an admin can assign the other roles', async () => {
    await assertSucceeds(updateDoc(doc(ADMIN(), 'users/g1'), edit(['marketing', 'contributor', 'social_admin', 'venue_host'])));
  });
  it('rejects a role that does not exist', async () => {
    await assertFails(updateDoc(doc(ADMIN(), 'users/g1'), edit(['god-mode'])));
  });
  it('an admin can NOT grant admin (super admin only)', async () => {
    await assertFails(updateDoc(doc(ADMIN(), 'users/g1'), edit(['admin'])));
  });
  it('an admin can NOT remove another admin', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/a2'), userDoc('a2', 'admin2@x.com', ['admin']));
    });
    await assertFails(updateDoc(doc(ADMIN(), 'users/a2'), edit([])));
  });
  it('a super admin can grant and remove admin', async () => {
    await assertSucceeds(updateDoc(doc(SUPER(), 'users/g1'), edit(['admin'], 'super@x.com')));
    await assertSucceeds(updateDoc(doc(SUPER(), 'users/g1'), edit([], 'super@x.com')));
  });
  it('the change is stamped with the real admin, not a forged one', async () => {
    await assertFails(updateDoc(doc(ADMIN(), 'users/g1'), edit(['host'], 'super@x.com')));
  });
  it('admin edits cannot touch profile fields like email', async () => {
    await assertFails(updateDoc(doc(ADMIN(), 'users/g1'), { ...edit(['host']), email: 'hijack@x.com' }));
  });
  it('a plain host, a marketer and a venue host cannot change roles', async () => {
    await assertFails(updateDoc(doc(HOST(), 'users/g1'), edit(['host'], 'host@x.com')));
    await assertFails(updateDoc(doc(MARKETER(), 'users/g1'), edit(['host'], 'mkt@x.com')));
    await assertFails(updateDoc(doc(VENUE(), 'users/g1'), edit(['host'], 'venue@x.com')));
  });
  it('nobody can delete a user record', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(SUPER(), 'users/g1')));
  });
});

describe('what each role unlocks', () => {
  const eventDoc = (id: string) => ({
    id, raceId: 'custom', title: 'Party', venue: { id: 'v', name: 'V', city: 'C' }, dateUtc: '2026-10-01T00:00:00Z',
    tiers: [{ id: 't', label: 'GA', priceInr: 1 }], discounts: [], capacity: 5, bookedCount: 0, salesOpen: true,
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
  });
  it('host, admin and venue_host can create booking events; marketing and guests cannot', async () => {
    await assertSucceeds(setDoc(doc(HOST(), 'bookingEvents/e1'), eventDoc('e1')));
    await assertSucceeds(setDoc(doc(ADMIN(), 'bookingEvents/e2'), eventDoc('e2')));
    await assertSucceeds(setDoc(doc(VENUE(), 'bookingEvents/e3'), eventDoc('e3')));
    await assertFails(setDoc(doc(MARKETER(), 'bookingEvents/e4'), eventDoc('e4')));
    await assertFails(setDoc(doc(GUEST(), 'bookingEvents/e5'), eventDoc('e5')));
  });
  it('a venue_host does NOT get the quiz controls (results, live event)', async () => {
    await assertFails(setDoc(doc(VENUE(), 'settings/active'), { eventId: 'x' }));
    await assertSucceeds(setDoc(doc(HOST(), 'settings/active'), { eventId: 'x' }));
  });
  it('a host (role) gets the host console writes; a guest does not', async () => {
    await assertFails(setDoc(doc(GUEST(), 'settings/active'), { eventId: 'x' }));
  });
});

describe('invite links', () => {
  const invite = (over: Record<string, unknown> = {}) => ({
    role: 'community_member', createdBy: 'host@x.com', createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 864e5), active: true, ...over,
  });

  it('a host can mint a community_member link', async () => {
    await assertSucceeds(setDoc(doc(HOST(), 'invites/' + TOKEN), invite()));
  });
  it('a host can NOT mint a higher link role, an admin can', async () => {
    await assertFails(setDoc(doc(HOST(), 'invites/' + TOKEN), invite({ role: 'contributor' })));
    await assertSucceeds(setDoc(doc(ADMIN(), 'invites/' + TOKEN), invite({ role: 'contributor', createdBy: 'admin@x.com' })));
  });
  it('NOBODY can mint a host or admin link', async () => {
    await assertFails(setDoc(doc(SUPER(), 'invites/' + TOKEN), invite({ role: 'host', createdBy: 'super@x.com' })));
    await assertFails(setDoc(doc(SUPER(), 'invites/' + TOKEN), invite({ role: 'admin', createdBy: 'super@x.com' })));
  });
  it('a guest or marketer cannot mint a link', async () => {
    await assertFails(setDoc(doc(GUEST(), 'invites/' + TOKEN), invite({ createdBy: 'guest@x.com' })));
    await assertFails(setDoc(doc(MARKETER(), 'invites/' + TOKEN), invite({ createdBy: 'mkt@x.com' })));
  });
  it('rejects a guessable (short) token', async () => {
    await assertFails(setDoc(doc(HOST(), 'invites/short'), invite()));
  });
  it('rejects a link valid for more than 90 days, or already expired', async () => {
    await assertFails(setDoc(doc(HOST(), 'invites/' + TOKEN), invite({ expiresAt: Timestamp.fromMillis(Date.now() + 120 * 864e5) })));
    await assertFails(setDoc(doc(HOST(), 'invites/' + TOKEN), invite({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) })));
  });
  it('the creator is stamped truthfully', async () => {
    await assertFails(setDoc(doc(HOST(), 'invites/' + TOKEN), invite({ createdBy: 'admin@x.com' })));
  });
  it('a signed-in person can open a link they hold, but nobody can list them all', async () => {
    await seedInvite(TOKEN);
    await assertSucceeds(getDoc(doc(GUEST(), 'invites/' + TOKEN)));
    await assertFails(getDocs(collection(GUEST(), 'invites')));
    await assertSucceeds(getDocs(collection(HOST(), 'invites')));
  });
  it('a host can revoke a link but never edit or re-enable it', async () => {
    await seedInvite(TOKEN);
    await assertFails(updateDoc(doc(HOST(), 'invites/' + TOKEN), { role: 'contributor' }));
    await assertSucceeds(updateDoc(doc(HOST(), 'invites/' + TOKEN), { active: false }));
    await assertFails(updateDoc(doc(HOST(), 'invites/' + TOKEN), { active: true }));
  });
});

describe('redeeming an invite', () => {
  const join = (roles: string[], via = TOKEN) => ({ roles, joinedVia: via });

  it('a guest redeems a live community_member link', async () => {
    await seedInvite(TOKEN);
    await assertSucceeds(updateDoc(doc(GUEST(), 'users/g1'), join(['community_member'])));
  });
  it('keeps the roles they already had', async () => {
    await seedInvite(TOKEN);
    await assertSucceeds(updateDoc(doc(MARKETER(), 'users/m1'), join(['marketing', 'community_member'])));
  });
  it('cannot take more than the link grants', async () => {
    await seedInvite(TOKEN);
    await assertFails(updateDoc(doc(GUEST(), 'users/g1'), join(['community_member', 'host'])));
    await assertFails(updateDoc(doc(GUEST(), 'users/g1'), join(['admin'])));
  });
  it('cannot use a link to drop roles they hold', async () => {
    await seedInvite(TOKEN);
    await assertFails(updateDoc(doc(MARKETER(), 'users/m1'), join(['community_member'])));
  });
  it('a revoked link grants nothing', async () => {
    await seedInvite(TOKEN, { active: false });
    await assertFails(updateDoc(doc(GUEST(), 'users/g1'), join(['community_member'])));
  });
  it('an expired link grants nothing', async () => {
    await seedInvite(TOKEN, { expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    await assertFails(updateDoc(doc(GUEST(), 'users/g1'), join(['community_member'])));
  });
  it('a link that does not exist grants nothing', async () => {
    await assertFails(updateDoc(doc(GUEST(), 'users/g1'), join(['community_member'], 'nopenopenopenopenopenopenope')));
  });
  it('even a forged invite for host cannot be redeemed', async () => {
    await seedInvite(TOKEN, { role: 'host' });
    await assertFails(updateDoc(doc(GUEST(), 'users/g1'), join(['host'])));
  });
  it('cannot redeem for another person', async () => {
    await seedInvite(TOKEN);
    await assertFails(updateDoc(doc(GUEST(), 'users/h1'), join(['host', 'community_member'])));
  });
});
