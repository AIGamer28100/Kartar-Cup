import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const tok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const as = (uid: string, email: string) => env.authenticatedContext(uid, tok(email)).firestore();
const host = () => as('h1', 'host@x.com');
const player = () => as('g1', 'guest1@example.com');
const A = 'settings/active';

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-livequiz-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'hosts/host@x.com'), { role: 'host' }); });
});

describe('settings/active (R64)', () => {
  it('anyone, even signed out, can read it', async () => {
    await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), A)));
  });
  it('host sets Manual with an event', async () => { await assertSucceeds(setDoc(doc(host(), A), { eventId: 'ev1', mode: 'manual' })); });
  it('host sets Auto', async () => { await assertSucceeds(setDoc(doc(host(), A), { mode: 'auto' })); });
  it('legacy doc with only eventId (no mode) is valid', async () => { await assertSucceeds(setDoc(doc(host(), A), { eventId: 'ev1' })); });
  it('host merge writes keep the other field', async () => {
    await assertSucceeds(setDoc(doc(host(), A), { eventId: 'ev1', mode: 'manual' }));
    await assertSucceeds(setDoc(doc(host(), A), { mode: 'auto' }, { merge: true }));
    await assertSucceeds(setDoc(doc(host(), A), { eventId: 'ev2' }, { merge: true }));
    const d = (await getDoc(doc(host(), A))).data();
    if (d?.eventId !== 'ev2' || d?.mode !== 'auto') throw new Error('merge lost a field: ' + JSON.stringify(d));
  });
  it('rejects an unknown mode', async () => { await assertFails(setDoc(doc(host(), A), { mode: 'semi' })); });
  it('rejects extra fields', async () => { await assertFails(setDoc(doc(host(), A), { mode: 'auto', foo: 1 })); });
  it('rejects an empty write', async () => { await assertFails(setDoc(doc(host(), A), {})); });
  it('rejects an empty or oversized or non-string eventId', async () => {
    await assertFails(setDoc(doc(host(), A), { eventId: '' }));
    await assertFails(setDoc(doc(host(), A), { eventId: 'x'.repeat(61) }));
    await assertFails(setDoc(doc(host(), A), { eventId: 5 }));
  });
  it('accepts a 60-char eventId (boundary)', async () => { await assertSucceeds(setDoc(doc(host(), A), { eventId: 'x'.repeat(60) })); });
  it('a signed-in player cannot write or update', async () => {
    await assertFails(setDoc(doc(player(), A), { mode: 'auto' }));
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), A), { mode: 'manual' }); });
    await assertFails(updateDoc(doc(player(), A), { mode: 'auto' }));
  });
  it('a signed-out visitor cannot write', async () => {
    await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), A), { mode: 'auto' }));
  });
  it('a host with an unverified or non-google token cannot write', async () => {
    const bad = env.authenticatedContext('h1', { email: 'host@x.com', email_verified: false, firebase: { sign_in_provider: 'google.com' } }).firestore();
    await assertFails(setDoc(doc(bad, A), { mode: 'auto' }));
  });
});
