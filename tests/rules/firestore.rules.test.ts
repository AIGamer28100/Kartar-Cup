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
const EID = 'ev1';
const QIDS = ['q1', 'q2', 'q3', 'q4', 'q5'];

const eventDoc = (over: Record<string, unknown> = {}) => ({
  id: EID, raceId: 'custom', name: 'Test Race', subtitle: 'Sub', circuit: null, themeId: 't',
  raceStartUtc: past(), raceDurationMin: 90, opensAt: past(), closesAt: future(),
  override: 'none', whatsappUrl: '',
  teams: [{ id: 'a', label: 'A' }],
  drivers: [{ id: 'd', label: 'D', teamId: 'a', grid: 1 }],
  questions: QIDS.map((id) => ({ id, prompt: 'p', kind: 'team' })),
  questionIds: QIDS, winnerRevealed: false, tiebreakOverride: null,
  createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...over,
});

async function seed(over: Record<string, unknown> = {}, activeId: string | null = EID) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'events/' + EID), eventDoc(over));
    if (activeId) await setDoc(doc(db, 'settings/active'), { eventId: activeId });
    await setDoc(doc(db, 'events/' + EID + '/results/answers'), {
      answers: { q1: ['a'], q2: ['b'], q3: ['c'], q4: ['d'], q5: ['e'] }, source: 's', updatedAt: Timestamp.now(),
    });
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
    await setDoc(doc(db, 'events/' + EID + '/entries/other'), { uid: 'other', name: 'Other' });
  });
}

const E = 'events/' + EID + '/entries/';
const RES = 'events/' + EID + '/results/answers';

const answers = () => ({ q1: 'a', q2: 'b', q3: 'c', q4: 'd', q5: 'e' });
const entry = (uid: string, over: Record<string, unknown> = {}) => ({
  uid, name: 'Guest One', provider: 'google', email: 'guest1@example.com', answers: answers(),
  submittedAt: serverTimestamp(), createdAt: serverTimestamp(), ...over,
});

const gtok = (email = 'guest1@example.com', extra: Record<string, unknown> = {}) => ({
  email, email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra,
});
const guest = (uid = 'g1') => env.authenticatedContext(uid, gtok()).firestore();
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
  it('google guest creates own entry', async () => {
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
});
describe('2 other uid', () => {
  it('denied for other doc id', async () => {
    await assertFails(setDoc(doc(guest(), E + 'g2'), entry('g2')));
  });
  it('denied for mismatched uid field', async () => {
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g2')));
  });
});
describe('3 override closed', () => {
  it('denied when override closed', async () => {
    await seed({ override: 'closed' });
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
});
describe('4 window (server clock)', () => {
  it('denied before opensAt', async () => {
    await seed({ opensAt: future(), closesAt: Timestamp.fromMillis(Date.now() + 7200_000) });
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
  it('denied after closesAt', async () => {
    await seed({ opensAt: Timestamp.fromMillis(Date.now() - 7200_000), closesAt: past() });
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
  it('override open allowed before opensAt', async () => {
    await seed({ override: 'open', opensAt: future(), closesAt: Timestamp.fromMillis(Date.now() + 7200_000) });
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
  it('override open denied after closesAt', async () => {
    await seed({ override: 'open', opensAt: Timestamp.fromMillis(Date.now() - 7200_000), closesAt: past() });
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
  it('denied for a non-active event', async () => {
    await seed({}, 'other-event');
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
  it('denied when no active event is set', async () => {
    await env.clearFirestore();
    await seed({}, null);
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
});
describe('4b questionIds', () => {
  it('answers not matching questionIds denied', async () => {
    await seed({ questionIds: ['x1', 'x2', 'x3', 'x4', 'x5'],
      questions: ['x1', 'x2', 'x3', 'x4', 'x5'].map((id) => ({ id, prompt: 'p', kind: 'team' })) });
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
  it('matching custom questionIds allowed', async () => {
    await seed({ questionIds: ['x1', 'x2'], questions: ['x1', 'x2'].map((id) => ({ id, prompt: 'p', kind: 'team' })) });
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'), entry('g1', { answers: { x1: 'a', x2: 'b' } })));
  });
  it('answer over 40 chars denied', async () => {
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1', { answers: { ...answers(), q1: 'x'.repeat(41) } })));
  });
});
describe('5 malformed', () => {
  const put = (data: Record<string, unknown>) => setDoc(doc(guest(), E + 'g1'), data);
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
describe('6 google-only identity (R14)', () => {
  const put = (ctxTok: Record<string, unknown>, over: Record<string, unknown> = {}) =>
    setDoc(doc(env.authenticatedContext('g1', ctxTok).firestore(), E + 'g1'), entry('g1', over));
  it('email mismatch denied', async () => {
    await assertFails(put(gtok(), { email: 'other@example.com' }));
  });
  it('missing email denied', async () => {
    const { email: _omit, ...noEmail } = entry('g1');
    await assertFails(setDoc(doc(guest(), E + 'g1'), noEmail));
  });
  it('unverified email denied', async () => {
    await assertFails(put(gtok('guest1@example.com', { email_verified: false })));
  });
  it('anonymous provider user denied', async () => {
    await assertFails(put({ firebase: { sign_in_provider: 'anonymous' } }, { provider: 'anonymous' }));
    await assertFails(put({ firebase: { sign_in_provider: 'anonymous' } }));
  });
  it('provider field anonymous denied', async () => {
    await assertFails(put(gtok(), { provider: 'anonymous' }));
  });
  it('case-insensitive email ok', async () => {
    await assertSucceeds(put(gtok('Guest1@Example.com')));
  });
});
describe('7 update', () => {
  const created = Timestamp.fromMillis(Date.now() - 5000);
  async function seedOwn() {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), E + 'g1'), {
        uid: 'g1', name: 'Guest One', provider: 'google', email: 'guest1@example.com', answers: answers(),
        submittedAt: created, createdAt: created,
      });
    });
  }
  it('owner updates answers while open', async () => {
    await seedOwn();
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'),
      entry('g1', { answers: { ...answers(), q1: 'z' }, createdAt: created })));
  });
  it('changing createdAt denied', async () => {
    await seedOwn();
    await assertFails(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
});
describe('8 reads', () => {
  it('guest get other entry denied', async () => {
    await assertFails(getDoc(doc(guest(), E + 'other')));
  });
  it('guest list denied', async () => {
    await assertFails(getDocs(collection(guest(), 'events/' + EID + '/entries')));
  });
  it('unauth get denied', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), E + 'other')));
  });
});
describe('9 settings and events', () => {
  it('guest reads settings/active', async () => {
    await assertSucceeds(getDoc(doc(guest(), 'settings/active')));
  });
  it('guest reads event', async () => {
    await assertSucceeds(getDoc(doc(guest(), 'events/' + EID)));
  });
  it('guest writes event denied', async () => {
    await assertFails(setDoc(doc(guest(), 'events/' + EID), eventDoc()));
  });
  it('guest writes settings/active denied', async () => {
    await assertFails(setDoc(doc(guest(), 'settings/active'), { eventId: 'evil' }));
  });
});
describe('10 results', () => {
  it('denied before reveal', async () => {
    await assertFails(getDoc(doc(guest(), RES)));
  });
  it('allowed after reveal', async () => {
    await seed({ winnerRevealed: true });
    await assertSucceeds(getDoc(doc(guest(), RES)));
  });
  it('guest write denied', async () => {
    await assertFails(setDoc(doc(guest(), RES), { answers: {}, source: 'x', updatedAt: Timestamp.now() }));
  });
});
describe('11 host', () => {
  it('lists entries', async () => {
    await assertSucceeds(getDocs(collection(host(), 'events/' + EID + '/entries')));
  });
  it('writes event', async () => {
    await assertSucceeds(setDoc(doc(host(), 'events/' + EID), eventDoc({ override: 'closed' })));
  });
  it('writes new event and settings/active', async () => {
    await assertSucceeds(setDoc(doc(host(), 'events/ev2'), eventDoc({ id: 'ev2' })));
    await assertSucceeds(setDoc(doc(host(), 'settings/active'), { eventId: 'ev2' }));
  });
  it('writes results', async () => {
    await assertSucceeds(setDoc(doc(host(), RES),
      { answers: { q1: [], q2: [], q3: [], q4: [], q5: [] }, source: 'x', updatedAt: Timestamp.now() }));
  });
});
describe('11b event validation (host)', () => {
  const put = (over: Record<string, unknown>) => setDoc(doc(host(), 'events/' + EID), eventDoc(over));
  it('closesAt <= opensAt rejected', async () => {
    const t = Timestamp.fromMillis(Date.now() + 1000);
    await assertFails(put({ opensAt: t, closesAt: t }));
    await assertFails(put({ opensAt: future(), closesAt: past() }));
  });
  it('whatsappUrl allowlist', async () => {
    await assertSucceeds(put({ whatsappUrl: 'https://chat.whatsapp.com/AbC123' }));
    await assertSucceeds(put({ whatsappUrl: 'https://whatsapp.com/channel/AbC123' }));
    await assertSucceeds(put({ whatsappUrl: '' }));
    await assertFails(put({ whatsappUrl: 'https://evil.com/x' }));
    await assertFails(put({ whatsappUrl: 'http://chat.whatsapp.com/AbC123' }));
    await assertFails(put({ whatsappUrl: 'https://chat.whatsapp.com.evil.com/AbC' }));
    await assertFails(put({ whatsappUrl: 'javascript:alert(1)' }));
  });
  it('size caps', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 'x' + i, label: 'x' }));
    await assertFails(put({ teams: many(13) }));
    await assertFails(put({ drivers: many(25) }));
    const qs = Array.from({ length: 9 }, (_, i) => ({ id: 'q' + i, prompt: 'p', kind: 'team' }));
    await assertFails(put({ questions: qs, questionIds: qs.map((q) => q.id) }));
    await assertFails(put({ name: 'x'.repeat(81) }));
  });
  it('per-item length caps', async () => {
    await assertFails(put({ drivers: [{ id: 'd', label: 'x'.repeat(81), teamId: 'a', grid: 1 }] }));
    const qs = (o: Record<string, unknown>) => QIDS.map((id) => ({ id, prompt: 'p', kind: 'team', ...o }));
    await assertFails(put({ questions: qs({ prompt: 'x'.repeat(81) }) }));
    await assertFails(put({ questions: qs({ hint: 'x'.repeat(161) }) }));
    await assertSucceeds(put({ questions: qs({ prompt: 'x'.repeat(80) }) }));
    await assertSucceeds(put({ questions: qs({ hint: 'h'.repeat(160) }) }));
  });
  it('full-size event (12 teams, 24 drivers, 8 questions with hints) fits the rules budget', async () => {
    const teams = Array.from({ length: 12 }, (_, i) => ({ id: 't' + i, label: 'Team ' + i }));
    const drivers = Array.from({ length: 24 }, (_, i) => ({ id: 'd' + i, label: 'Driver ' + i, teamId: 't0', grid: i + 1 }));
    const ids = Array.from({ length: 8 }, (_, i) => 'q' + (i + 1));
    const questions = ids.map((id) => ({ id, prompt: 'p', kind: 'driver', hint: 'h' }));
    await assertSucceeds(put({ teams, drivers, questions, questionIds: ids, nextQuestionSeq: 9 }));
  });
  it('nextQuestionSeq shape', async () => {
    await assertSucceeds(put({ nextQuestionSeq: 9 }));
    await assertFails(put({ nextQuestionSeq: 'nine' }));
    await assertFails(put({ nextQuestionSeq: 0 }));
  });
  it('bad override and questionIds mirror mismatch rejected', async () => {
    await assertFails(put({ override: 'maybe' }));
    await assertFails(put({ questionIds: ['q1'] }));
  });
});
describe('12 non-hosts', () => {
  it('google user not in hosts denied', async () => {
    const db = env.authenticatedContext('u9', {
      email: 'nobody@x.com', email_verified: true, firebase: { sign_in_provider: 'google.com' },
    }).firestore();
    await assertFails(getDocs(collection(db, 'events/' + EID + '/entries')));
    await assertFails(setDoc(doc(db, 'events/' + EID), eventDoc()));
  });
  it('allowlisted but unverified email denied', async () => {
    const db = env.authenticatedContext('u8', {
      email: 'host@x.com', email_verified: false, firebase: { sign_in_provider: 'google.com' },
    }).firestore();
    await assertFails(getDocs(collection(db, 'events/' + EID + '/entries')));
    await assertFails(setDoc(doc(db, 'events/' + EID), eventDoc()));
  });
  it('anonymous user denied', async () => {
    const db = env.authenticatedContext('u7', { firebase: { sign_in_provider: 'google', email: 'guest1@example.com' } }).firestore();
    await assertFails(getDocs(collection(db, 'events/' + EID + '/entries')));
    await assertFails(setDoc(doc(db, 'events/' + EID), eventDoc()));
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
      await setDoc(doc(ctx.firestore(), E + 'g1'), { uid: 'g1', name: 'Guest One' });
    });
    await assertFails(deleteDoc(doc(guest(), E + 'g1')));
  });
});
describe('15 entry photoURL (PD1)', () => {
  it('accepted when it is a real Google-hosted avatar URL', async () => {
    await assertSucceeds(
      setDoc(doc(guest(), E + 'g1'), entry('g1', { photoURL: 'https://lh3.googleusercontent.com/a/abc123' })),
    );
  });
  it('rejected when it is some other URL', async () => {
    await assertFails(
      setDoc(doc(guest(), E + 'g1'), entry('g1', { photoURL: 'https://evil.com/avatar.png' })),
    );
  });
  it('entries without photoURL still work (optional)', async () => {
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
});
describe('16 screen/state (PD1, R15 host-only)', () => {
  const S = 'events/' + EID + '/screen/state';
  const screenDoc = () => ({ mode: 'podium', stage: 1, overrideUid: null, updatedAt: Timestamp.now() });
  it('host can read and write', async () => {
    await assertSucceeds(setDoc(doc(host(), S), screenDoc()));
    await assertSucceeds(getDoc(doc(host(), S)));
  });
  it('signed-in guest denied read and write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), S), screenDoc());
    });
    await assertFails(getDoc(doc(guest(), S)));
    await assertFails(setDoc(doc(guest(), S), screenDoc()));
  });
  it('signed-out denied read and write', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), S), screenDoc());
    });
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, S)));
    await assertFails(setDoc(doc(anon, S), screenDoc()));
  });
});

describe('17 prediction depth: yesno + points', () => {
  const YN = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];
  const ynQs = (extra: Record<string, unknown> = {}) =>
    YN.map((id) => (id === 'q6' ? { id, prompt: 'Safety car?', kind: 'yesno', ...extra } : { id, prompt: 'p', kind: 'team' }));
  const seedYn = () => seed({ questionIds: YN, questions: ynQs() });
  const yn = (uid: string, v: string) => entry(uid, { answers: { ...answers(), q6: v } });
  const put = (over: Record<string, unknown>) => setDoc(doc(host(), 'events/' + EID), eventDoc(over));

  it('valid yes and no answers accepted', async () => {
    await seedYn();
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'), yn('g1', 'yes')));
    await assertSucceeds(setDoc(doc(guest('g2'), E + 'g2'), yn('g2', 'no')));
  });
  it('invalid yesno answer id rejected', async () => {
    await seedYn();
    await assertFails(setDoc(doc(guest(), E + 'g1'), yn('g1', 'maybe')));
    await assertFails(setDoc(doc(guest(), E + 'g1'), yn('g1', 'Yes')));
    await assertFails(setDoc(doc(guest(), E + 'g1'), yn('g1', '')));
    await assertFails(setDoc(doc(guest(), E + 'g1'), yn('g1', 'd')));
  });
  it('yesno update path validates too', async () => {
    await seedYn();
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'), yn('g1', 'yes')));
    await assertFails(setDoc(doc(guest(), E + 'g1'), yn('g1', 'maybe')));
  });
  it('default 5-question entries still pass (no points, no yesno)', async () => {
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'), entry('g1')));
  });
  it('guest cannot read other guests entries (yesno event)', async () => {
    await seedYn();
    await assertFails(getDoc(doc(guest(), E + 'other')));
    await assertFails(getDocs(collection(guest(), 'events/' + EID + '/entries')));
  });
  it('host can save yesno and points on questions', async () => {
    await assertSucceeds(put({ questionIds: YN, questions: ynQs({ points: 3 }) }));
    await assertSucceeds(put({ questionIds: YN, questions: ynQs({ points: 10 }) }));
    await assertSucceeds(put({ questionIds: YN, questions: ynQs({ points: 1 }) }));
  });
  it('points are host-only: guest cannot write the event config', async () => {
    await assertFails(setDoc(doc(guest(), 'events/' + EID), eventDoc({ questionIds: YN, questions: ynQs({ points: 10 }) })));
  });
  it('full-size 8-question event with yesno + points fits the rules budget', async () => {
    const ids = Array.from({ length: 8 }, (_, i) => 'q' + (i + 1));
    const questions = ids.map((id, i) => ({ id, prompt: 'p', kind: i % 2 ? 'yesno' : 'driver', hint: 'h', points: 10 }));
    await assertSucceeds(put({ questions, questionIds: ids, nextQuestionSeq: 9 }));
    await seed({ questions, questionIds: ids });
    const a = Object.fromEntries(ids.map((id, i) => [id, i % 2 ? 'no' : 'd']));
    await assertSucceeds(setDoc(doc(guest(), E + 'g1'), entry('g1', { answers: a })));
  });
});
