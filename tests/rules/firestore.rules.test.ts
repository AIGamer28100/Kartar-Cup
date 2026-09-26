import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, getDocs, collection, setDoc, deleteDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const HOST_TOKEN = {
  email: 'host@x.com',
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
};

const future = () => Timestamp.fromMillis(Date.now() + 3600_000);
const past = () => Timestamp.fromMillis(Date.now() - 3600_000);

async function seed(status = 'open', lightsOut: Timestamp = future()) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'event/current'), {
      status, lightsOutUtc: lightsOut, winnerRevealed: false, tiebreakOverride: null,
    });
    await setDoc(doc(db, 'event/results'), {
      answers: { q1: ['a'], q2: ['b'], q3: ['c'], q4: ['d'], q5: ['e'] }, source: 's', updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
    await setDoc(doc(db, 'entries/other'), { uid: 'other', name: 'Other' });
  });
}

const answers = () => ({ q1: 'a', q2: 'b', q3: 'c', q4: 'd', q5: 'e' });
const entry = (uid: string, over: Record<string, unknown> = {}) => ({
  uid, name: 'Guest One', provider: 'anonymous', answers: answers(),
  submittedAt: serverTimestamp(), createdAt: serverTimestamp(), ...over,
});

const guest = (uid = 'g1') => env.authenticatedContext(uid).firestore();
const host = () => env.authenticatedContext('h1', HOST_TOKEN).firestore();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe('1 create', () => {
  it('anon guest creates own entry', async () => {
    await assertSucceeds(setDoc(doc(guest(), 'entries/g1'), entry('g1')));
  });
});
describe('2 other uid', () => {
  it('denied for other doc id', async () => {
    await assertFails(setDoc(doc(guest(), 'entries/g2'), entry('g2')));
  });
  it('denied for mismatched uid field', async () => {
    await assertFails(setDoc(doc(guest(), 'entries/g1'), entry('g2')));
  });
});
describe('3 locked', () => {
  it('denied when locked', async () => {
    await seed('locked');
    await assertFails(setDoc(doc(guest(), 'entries/g1'), entry('g1')));
  });
});
describe('4 past lights out', () => {
  it('denied when open but past lightsOut', async () => {
    await seed('open', past());
    await assertFails(setDoc(doc(guest(), 'entries/g1'), entry('g1')));
  });
});
describe('5 malformed', () => {
  const put = (data: Record<string, unknown>) => setDoc(doc(guest(), 'entries/g1'), data);
  it('missing q5', async () => {
    const a: Record<string, string> = answers(); delete a.q5;
    await assertFails(put(entry('g1', { answers: a })));
  });
  it('extra answer key', async () => {
    await assertFails(put(entry('g1', { answers: { ...answers(), q6: 'x' } })));
  });
  it('extra field score', async () => {
    await assertFails(put(entry('g1', { score: 5 })));
  });
  it('name 61 chars', async () => {
    await assertFails(put(entry('g1', { name: 'x'.repeat(61) })));
  });
  it('bad phone', async () => {
    await assertFails(put(entry('g1', { phone: 'abc123' })));
  });
  it('client-supplied submittedAt', async () => {
    await assertFails(put(entry('g1', { submittedAt: Timestamp.fromMillis(Date.now() - 86400_000) })));
  });
});
describe('6 email mismatch', () => {
  it('denied', async () => {
    const db = env.authenticatedContext('g1', { email: 'me@x.com' }).firestore();
    await assertFails(setDoc(doc(db, 'entries/g1'), entry('g1', { provider: 'google', email: 'other@x.com' })));
  });
});
describe('7 update', () => {
  const created = Timestamp.fromMillis(Date.now() - 5000);
  async function seedOwn() {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'entries/g1'), {
        uid: 'g1', name: 'Guest One', provider: 'anonymous', answers: answers(),
        submittedAt: created, createdAt: created,
      });
    });
  }
  it('owner updates answers while open', async () => {
    await seedOwn();
    await assertSucceeds(setDoc(doc(guest(), 'entries/g1'),
      entry('g1', { answers: { ...answers(), q1: 'z' }, createdAt: created })));
  });
  it('changing createdAt denied', async () => {
    await seedOwn();
    await assertFails(setDoc(doc(guest(), 'entries/g1'), entry('g1')));
  });
});
describe('8 reads', () => {
  it('guest get other entry denied', async () => {
    await assertFails(getDoc(doc(guest(), 'entries/other')));
  });
  it('guest list denied', async () => {
    await assertFails(getDocs(collection(guest(), 'entries')));
  });
  it('unauth get denied', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'entries/other')));
  });
});
describe('9 event/current', () => {
  it('guest reads', async () => {
    await assertSucceeds(getDoc(doc(guest(), 'event/current')));
  });
  it('guest writes denied', async () => {
    await assertFails(setDoc(doc(guest(), 'event/current'), { status: 'scored' }));
  });
});
describe('10 event/results', () => {
  it('denied while locked', async () => {
    await seed('locked');
    await assertFails(getDoc(doc(guest(), 'event/results')));
  });
  it('allowed after scored', async () => {
    await seed('scored');
    await assertSucceeds(getDoc(doc(guest(), 'event/results')));
  });
});
describe('11 host', () => {
  it('lists entries', async () => {
    await assertSucceeds(getDocs(collection(host(), 'entries')));
  });
  it('writes event/current', async () => {
    await assertSucceeds(setDoc(doc(host(), 'event/current'),
      { status: 'locked', lightsOutUtc: future(), winnerRevealed: false, tiebreakOverride: null }));
  });
  it('writes event/results', async () => {
    await assertSucceeds(setDoc(doc(host(), 'event/results'),
      { answers: { q1: [], q2: [], q3: [], q4: [], q5: [] }, source: 'x', updatedAt: Timestamp.now() }));
  });
});
describe('12 non-hosts', () => {
  it('google user not in hosts denied', async () => {
    const db = env.authenticatedContext('u9', {
      email: 'nobody@x.com', email_verified: true, firebase: { sign_in_provider: 'google.com' },
    }).firestore();
    await assertFails(getDocs(collection(db, 'entries')));
    await assertFails(setDoc(doc(db, 'event/current'), { status: 'scored' }));
  });
  it('allowlisted but unverified email denied', async () => {
    const db = env.authenticatedContext('u8', {
      email: 'host@x.com', email_verified: false, firebase: { sign_in_provider: 'google.com' },
    }).firestore();
    await assertFails(getDocs(collection(db, 'entries')));
    await assertFails(setDoc(doc(db, 'event/current'), { status: 'scored' }));
  });
  it('anonymous user denied', async () => {
    const db = env.authenticatedContext('u7', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertFails(getDocs(collection(db, 'entries')));
    await assertFails(setDoc(doc(db, 'event/current'), { status: 'scored' }));
  });
});
describe('13 hosts writes', () => {
  it('guest write denied', async () => {
    await assertFails(setDoc(doc(guest(), 'hosts/g1@x.com'), { role: 'host' }));
  });
  it('host create denied', async () => {
    await assertFails(setDoc(doc(host(), 'hosts/new@x.com'), { role: 'host' }));
  });
  it('host delete denied', async () => {
    await assertFails(deleteDoc(doc(host(), 'hosts/host@x.com')));
  });
});
describe('14 delete', () => {
  it('guest deletes own entry denied', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'entries/g1'), { uid: 'g1', name: 'Guest One' });
    });
    await assertFails(deleteDoc(doc(guest(), 'entries/g1')));
  });
});
