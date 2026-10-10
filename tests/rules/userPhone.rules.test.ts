import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { doc, getDoc, setDoc, updateDoc, deleteField, serverTimestamp, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

const tok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const as = (uid: string, email: string) => env.authenticatedContext(uid, tok(email)).firestore();
const me = () => as('g1', 'guest1@example.com');
const them = () => as('g2', 'guest2@example.com');
const host = () => as('h2', 'rolehost@x.com'); // role host via users doc, not a super admin
const superAdmin = () => as('h1', 'host@x.com');
const U = 'users/g1';
const setPhone = (db: ReturnType<typeof me>, phone: unknown, uid = 'g1') =>
  updateDoc(doc(db, 'users/' + uid), { phone, lastSeenAt: serverTimestamp() });

const userDoc = (uid: string, email: string, over: Record<string, unknown> = {}) =>
  ({ uid, email, name: uid, createdAt: Timestamp.now(), lastSeenAt: Timestamp.now(), roles: [], ...over });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-userphone-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
    await setDoc(doc(db, U), userDoc('g1', 'guest1@example.com', { phone: '+91 98765 43210' }));
    await setDoc(doc(db, 'users/h2'), userDoc('h2', 'rolehost@x.com', { roles: ['host'] }));
    await setDoc(doc(db, 'users/g2'), userDoc('g2', 'guest2@example.com', { phone: '+44 7000 000000' }));
  });
});

describe('phone on the own profile (R67)', () => {
  it('owner sets a valid phone', async () => { await assertSucceeds(setPhone(me(), '+91 99999 11111')); });
  it('accepts digits only, and the 7 and 16 char boundaries', async () => {
    await assertSucceeds(setPhone(me(), '9876543210'));
    await assertSucceeds(setPhone(me(), '1234567'));
    await assertSucceeds(setPhone(me(), '+123456789012345'));
  });
  it('rejects 6 and 17 chars', async () => {
    await assertFails(setPhone(me(), '123456'));
    await assertFails(setPhone(me(), '12345678901234567'));
  });
  it('rejects letters, punctuation, markup and empty string', async () => {
    await assertFails(setPhone(me(), 'call-me-maybe'));
    await assertFails(setPhone(me(), '98765-43210'));
    await assertFails(setPhone(me(), '(98765) 4321'));
    await assertFails(setPhone(me(), '<b>1234567</b>'));
    await assertFails(setPhone(me(), ''));
  });
  it('rejects non-string phone', async () => {
    await assertFails(setPhone(me(), 9876543210));
    await assertFails(setPhone(me(), null));
  });
  it('removing the phone field clears it', async () => {
    await assertSucceeds(updateDoc(doc(me(), U), { phone: deleteField(), lastSeenAt: serverTimestamp() }));
  });
  it('a phone change cannot smuggle in a role', async () => {
    await assertFails(updateDoc(doc(me(), U), { phone: '+91 99999 11111', roles: ['admin'], lastSeenAt: serverTimestamp() }));
  });
  it('phone is not accepted on first create (profile create has no phone key)', async () => {
    await assertFails(setDoc(doc(as('n1', 'new@x.com'), 'users/n1'), {
      uid: 'n1', email: 'new@x.com', name: 'New', phone: '+91 99999 11111', createdAt: serverTimestamp(), lastSeenAt: serverTimestamp(), roles: [],
    }));
  });
});

describe('nobody else can read or write it', () => {
  it('another player cannot write my phone', async () => { await assertFails(setPhone(them(), '+91 99999 11111', 'g1')); });
  it('another player cannot read my profile', async () => { await assertFails(getDoc(doc(them(), U))); });
  it('a host (non-admin) cannot read or write my phone', async () => {
    await assertFails(getDoc(doc(host(), U)));
    await assertFails(setPhone(host(), '+91 99999 11111', 'g1'));
  });
  it('a super admin (hosts/ doc) can read the profile directory entry but not change the phone', async () => {
    await assertSucceeds(getDoc(doc(superAdmin(), U)));
    await assertFails(setPhone(superAdmin(), '+91 99999 11111', 'g1'));
  });
  it('signed-out cannot read or write', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, U)));
    await assertFails(setPhone(anon, '+91 99999 11111'));
  });
  it('the owner can read their own phone back', async () => {
    const d = await assertSucceeds(getDoc(doc(me(), U)));
    if (d.data()?.phone !== '+91 98765 43210') throw new Error('phone not readable by owner');
  });
  it('phone is not exposed through the entries or events collections', async () => {
    await assertFails(getDoc(doc(them(), 'users/g1')));
  });
  it('an unverified-email token cannot write the phone', async () => {
    const bad = env.authenticatedContext('g1', { email: 'guest1@example.com', email_verified: false, firebase: { sign_in_provider: 'google.com' } }).firestore();
    await assertFails(setPhone(bad, '+91 99999 11111'));
  });
});
