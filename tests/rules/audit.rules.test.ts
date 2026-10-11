import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { addDoc, collection, deleteDoc, doc, getDocs, setDoc, Timestamp, updateDoc, serverTimestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

const HOST_EMAIL = 'host@x.com';
const gtok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const host = () => env.authenticatedContext('h1', gtok(HOST_EMAIL)).firestore();
const guest = () => env.authenticatedContext('g1', gtok('guest1@example.com')).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const entry = (over: Record<string, unknown> = {}) => ({
  action: 'results.save',
  actor: HOST_EMAIL,
  target: 'event-1',
  detail: 'official timing sheet',
  at: serverTimestamp(),
  ...over,
});

async function seedLog(id = 'log1') {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'auditLogs/' + id), {
      action: 'results.save', actor: HOST_EMAIL, target: 'event-1', at: Timestamp.now(),
    });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-audit-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'hosts/' + HOST_EMAIL), { role: 'host' });
  });
});

describe('auditLogs create', () => {
  it('host can record an action', async () => {
    await assertSucceeds(addDoc(collection(host(), 'auditLogs'), entry()));
  });
  it('detail is optional', async () => {
    const { detail: _d, ...noDetail } = entry();
    await assertSucceeds(addDoc(collection(host(), 'auditLogs'), noDetail));
  });
  it('a guest cannot write', async () => {
    await assertFails(addDoc(collection(guest(), 'auditLogs'), entry({ actor: 'guest1@example.com' })));
  });
  it('signed-out cannot write', async () => {
    await assertFails(addDoc(collection(anon(), 'auditLogs'), entry()));
  });
  it('actor cannot be someone else (no attributing an action to another host)', async () => {
    await assertFails(addDoc(collection(host(), 'auditLogs'), entry({ actor: 'someone.else@x.com' })));
  });
  it('timestamp must be the server clock (no backdating)', async () => {
    await assertFails(addDoc(collection(host(), 'auditLogs'), entry({ at: Timestamp.fromMillis(1_000_000_000_000) })));
  });
  it('rejects unknown fields', async () => {
    await assertFails(addDoc(collection(host(), 'auditLogs'), entry({ role: 'admin' })));
  });
  it('rejects a missing required field', async () => {
    const { target: _t, ...noTarget } = entry();
    await assertFails(addDoc(collection(host(), 'auditLogs'), noTarget));
  });
  it('rejects oversized detail', async () => {
    await assertFails(addDoc(collection(host(), 'auditLogs'), entry({ detail: 'x'.repeat(301) })));
  });
  it('rejects an empty or oversized action', async () => {
    await assertFails(addDoc(collection(host(), 'auditLogs'), entry({ action: '' })));
    await assertFails(addDoc(collection(host(), 'auditLogs'), entry({ action: 'a'.repeat(41) })));
  });
});

describe('auditLogs read', () => {
  it('host can list the log', async () => {
    await seedLog();
    await assertSucceeds(getDocs(collection(host(), 'auditLogs')));
  });
  it('a guest cannot read it', async () => {
    await seedLog();
    await assertFails(getDocs(collection(guest(), 'auditLogs')));
  });
  it('signed-out cannot read it', async () => {
    await seedLog();
    await assertFails(getDocs(collection(anon(), 'auditLogs')));
  });
});

describe('auditLogs are append-only', () => {
  it('a host cannot edit an entry', async () => {
    await seedLog();
    await assertFails(updateDoc(doc(host(), 'auditLogs/log1'), { detail: 'rewritten' }));
  });
  it('a host cannot delete an entry', async () => {
    await seedLog();
    await assertFails(deleteDoc(doc(host(), 'auditLogs/log1')));
  });
  it('a host cannot overwrite an entry by id', async () => {
    await seedLog();
    await assertFails(setDoc(doc(host(), 'auditLogs/log1'), entry()));
  });
});
