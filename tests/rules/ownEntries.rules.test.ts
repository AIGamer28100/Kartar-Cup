import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { collection, collectionGroup, doc, getDoc, getDocs, query, setDoc, where, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

const tok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const as = (uid: string, email: string) => env.authenticatedContext(uid, tok(email)).firestore();
const player = () => as('g1', 'guest1@example.com');
const host = () => as('h1', 'host@x.com');
const ent = (uid: string) => ({ uid, name: 'N ' + uid, provider: 'google', email: uid + '@x.com', answers: {}, accessToken: 'x', submittedAt: Timestamp.now(), createdAt: Timestamp.now() });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-ownentries-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
    for (const e of ['e1', 'e2']) {
      await setDoc(doc(db, 'events/' + e + '/entries/g1'), ent('g1'));
      await setDoc(doc(db, 'events/' + e + '/entries/g2'), ent('g2'));
    }
  });
});

describe('own-entries collection-group query (R66)', () => {
  it('a player lists only their own entries across events', async () => {
    const s = await assertSucceeds(getDocs(query(collectionGroup(player(), 'entries'), where('uid', '==', 'g1'))));
    if (s.size !== 2 || s.docs.some((d) => d.data().uid !== 'g1')) throw new Error('expected 2 own entries, got ' + s.size);
  });
  it('cannot list another uid', async () => {
    await assertFails(getDocs(query(collectionGroup(player(), 'entries'), where('uid', '==', 'g2'))));
  });
  it('cannot list unfiltered', async () => {
    await assertFails(getDocs(collectionGroup(player(), 'entries')));
  });
  it('signed-out cannot list, even filtered', async () => {
    await assertFails(getDocs(query(collectionGroup(env.unauthenticatedContext().firestore(), 'entries'), where('uid', '==', 'g1'))));
  });
  it('does not widen get: another player\'s entry doc is still denied', async () => {
    await assertFails(getDoc(doc(player(), 'events/e1/entries/g2')));
  });
  it('does not widen the per-event list for players', async () => {
    await assertFails(getDocs(collection(player(), 'events/e1/entries')));
  });
  it('does not allow writes via the group match', async () => {
    await assertFails(setDoc(doc(player(), 'events/e1/entries/g1'), ent('g1')));
    await assertFails(setDoc(doc(player(), 'events/e3/entries/g1'), ent('g1')));
  });
  it('host can still list the per-event entries', async () => {
    const s = await assertSucceeds(getDocs(collection(host(), 'events/e1/entries')));
    if (s.size !== 2) throw new Error('host should see 2, got ' + s.size);
  });
});
