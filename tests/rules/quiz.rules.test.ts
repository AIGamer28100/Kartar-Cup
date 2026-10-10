import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';

import { doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

const tok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const as = (uid: string, email: string) => env.authenticatedContext(uid, tok(email)).firestore();
const guest = () => as('g1', 'guest1@example.com');
const other = () => as('g2', 'guest2@example.com');
const host = () => as('h1', 'host@x.com');

const EID = 'ev1';
const TOKEN = 'abcdefghij0123456789ABCD'; // 24 chars
const QIDS = ['q1', 'q2', 'q3'];
const E = 'events/' + EID + '/entries/';
const min = (n: number) => Timestamp.fromMillis(Date.now() + n * 60_000);

const eventDoc = (over: Record<string, unknown> = {}) => ({
  id: EID, raceId: 'custom', name: 'Test Race', subtitle: 'S', circuit: null, themeId: 't',
  raceStartUtc: min(5), raceDurationMin: 90, opensAt: min(-5), closesAt: min(20),
  override: 'none', whatsappUrl: '', teams: [{ id: 'a', label: 'A' }],
  drivers: [{ id: 'd', label: 'D', teamId: 'a', grid: 1 }],
  questions: QIDS.map((id) => ({ id, prompt: 'p', kind: 'team' })), questionIds: QIDS,
  winnerRevealed: false, tiebreakOverride: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...over,
});
async function seed(over: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'events/' + EID), eventDoc(over));
    await setDoc(doc(db, 'playLinks/' + TOKEN), { eventId: EID, revoked: false, createdAt: Timestamp.now(), createdBy: 'host@x.com' });
    await setDoc(doc(db, 'playLinks/otherlinkABCDEFGHIJKLMNO'), { eventId: 'ev2', revoked: false, createdAt: Timestamp.now(), createdBy: 'host@x.com' });
    await setDoc(doc(db, 'playLinks/revokedlinkABCDEFGHIJKL'), { eventId: EID, revoked: true, createdAt: Timestamp.now(), createdBy: 'host@x.com' });
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
  });
}
const entry = (over: Record<string, unknown> = {}) => ({
  uid: 'g1', name: 'Guest One', provider: 'google', email: 'guest1@example.com',
  answers: { q1: 'a', q2: 'b', q3: 'c' }, accessToken: TOKEN,
  submittedAt: serverTimestamp(), createdAt: serverTimestamp(), ...over,
});
const submit = (over: Record<string, unknown> = {}) => setDoc(doc(guest(), E + 'g1'), entry(over));

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-quiz-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe('link-token gate', () => {
  it('a valid token for this quiz is accepted', async () => { await assertSucceeds(submit()); });
  it('no token is rejected', async () => {
    const e: Record<string, unknown> = entry(); delete e.accessToken;
    await assertFails(setDoc(doc(guest(), E + 'g1'), e));
  });
  it('an unknown token is rejected', async () => { await assertFails(submit({ accessToken: 'zzzzzzzzzzzzzzzzzzzzzzzz' })); });
  it('a token of the wrong length is rejected', async () => { await assertFails(submit({ accessToken: 'short' })); });
  it('a token that opens a different quiz is rejected', async () => { await assertFails(submit({ accessToken: 'otherlinkABCDEFGHIJKLMNO' })); });
  it('a revoked token is rejected', async () => { await assertFails(submit({ accessToken: 'revokedlinkABCDEFGHIJKL' })); });
});

describe('quiz window timing (Auto defaults, R61)', () => {
  it('opens 10 minutes before lights out: 8 min before is open', async () => {
    await seed({ raceStartUtc: min(8), opensAt: min(-1) });
    await assertSucceeds(submit());
  });
  it('11 minutes before lights out is still shut even if opensAt has passed', async () => {
    await seed({ raceStartUtc: min(11), opensAt: min(-1) });
    await assertFails(submit());
  });
  it('shut before opensAt even inside the 10-minute mark', async () => {
    await seed({ raceStartUtc: min(5), opensAt: min(2) });
    await assertFails(submit());
  });
  it('shut after closesAt', async () => {
    await seed({ raceStartUtc: min(-30), opensAt: min(-40), closesAt: min(-1) });
    await assertFails(submit());
  });
  it('shut once the leader has done floor(30%) laps', async () => {
    await seed({ totalLaps: 50, liveLap: 15, raceStartUtc: min(-3), raceStartedAt: min(-3) });
    await assertFails(submit());
  });
  it('open one lap before the lap cap', async () => {
    await seed({ totalLaps: 50, liveLap: 14, raceStartUtc: min(-3), raceStartedAt: min(-3) });
    await assertSucceeds(submit());
  });
  it('delayed race that has not started stays open past closesAt (30% clock does not run)', async () => {
    await seed({ delayed: true, raceStartUtc: min(-30), opensAt: min(-40), closesAt: min(-1) });
    await assertSucceeds(submit());
  });
  it('delayed flag does not help once the race has really started', async () => {
    await seed({ delayed: true, raceStartedAt: min(-30), raceStartUtc: min(-30), opensAt: min(-40), closesAt: min(-1) });
    await assertFails(submit());
  });
});

describe('Manual overrides (R70)', () => {
  it('Open now accepts entries long before the 10-minute mark', async () => {
    await seed({ override: 'open', raceStartUtc: min(120), opensAt: min(100), closesAt: min(200) });
    await assertSucceeds(submit());
  });
  it('closed override rejects even inside the window', async () => {
    await seed({ override: 'closed' });
    await assertFails(submit());
  });
  it('reopen (+5 min) accepts after closesAt was reset forward', async () => {
    await seed({ override: 'none', raceStartUtc: min(-30), opensAt: min(-40), closesAt: min(-1) });
    await assertFails(submit());
    await assertSucceeds(updateDoc(doc(host(), 'events/' + EID), { override: 'open', closesAt: min(5), updatedAt: serverTimestamp() }));
    await assertSucceeds(submit());
  });
  it('override open still rejects after closesAt', async () => {
    await seed({ override: 'open', raceStartUtc: min(-30), opensAt: min(-40), closesAt: min(-1) });
    await assertFails(submit());
  });
  it('lap cap still shuts an override-open quiz that was not extended past the 30% clock', async () => {
    await seed({ override: 'open', totalLaps: 50, liveLap: 15, raceStartUtc: min(-3), raceStartedAt: min(-3), closesAt: min(10) });
    await assertFails(submit());
  });
  it('Extend past the 30% cap reopens an override-open quiz despite the lap rule', async () => {
    // 30% clock = 90 * 18 s = 27 min after start; closesAt at +60 min is past it
    await seed({ override: 'open', totalLaps: 50, liveLap: 15, raceStartUtc: min(-3), raceStartedAt: min(-3), closesAt: min(60) });
    await assertSucceeds(submit());
  });
});

describe('hosts-only quiz setup writes', () => {
  it('a host can create an event', async () => {
    await assertSucceeds(setDoc(doc(host(), 'events/new1'), eventDoc({ id: 'new1', createdAt: serverTimestamp(), updatedAt: serverTimestamp() })));
  });
  it('a host cannot create an event that opens earlier than 10 min before lights out', async () => {
    await assertFails(setDoc(doc(host(), 'events/new1'), eventDoc({ id: 'new1', raceStartUtc: min(60), opensAt: min(0), closesAt: min(70) })));
  });
  it('a host cannot create an event whose close is past 30% of the race', async () => {
    await assertFails(setDoc(doc(host(), 'events/new1'), eventDoc({ id: 'new1', closesAt: min(5 + 28) })));
  });
  it('a player cannot create, update or delete an event', async () => {
    await assertFails(setDoc(doc(guest(), 'events/new1'), eventDoc({ id: 'new1' })));
    await assertFails(updateDoc(doc(guest(), 'events/' + EID), { override: 'open' }));
    await assertFails(setDoc(doc(guest(), 'events/' + EID), eventDoc({ override: 'open' })));
  });
  it('a player cannot mint or revoke a play link', async () => {
    await assertFails(setDoc(doc(guest(), 'playLinks/mintedlinkABCDEFGHIJKLMN'), { eventId: EID, revoked: false, createdAt: serverTimestamp(), createdBy: 'guest1@example.com' }));
    await assertFails(updateDoc(doc(guest(), 'playLinks/' + TOKEN), { revoked: true, revokedAt: serverTimestamp() }));
  });
  it('a host can mint a link and revoke it, but cannot un-revoke', async () => {
    await assertSucceeds(setDoc(doc(host(), 'playLinks/mintedlinkABCDEFGHIJKLMN'), { eventId: EID, revoked: false, createdAt: serverTimestamp(), createdBy: 'host@x.com' }));
    await assertSucceeds(updateDoc(doc(host(), 'playLinks/' + TOKEN), { revoked: true, revokedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(host(), 'playLinks/' + TOKEN), { revoked: false, revokedAt: serverTimestamp() }));
  });
  it('only a host can set raceStartedAt, and only once', async () => {
    await assertFails(updateDoc(doc(guest(), 'events/' + EID), { raceStartedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(host(), 'events/' + EID), { raceStartedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(host(), 'events/' + EID), { raceStartedAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  });
});

describe('picks are final (R68)', () => {
  beforeEach(async () => { await assertSucceeds(submit()); });
  it('the player cannot update their submitted entry', async () => {
    await assertFails(updateDoc(doc(guest(), E + 'g1'), { answers: { q1: 'x', q2: 'b', q3: 'c' } }));
  });
  it('the player cannot overwrite it by setDoc again', async () => {
    await assertFails(submit({ answers: { q1: 'x', q2: 'y', q3: 'z' } }));
  });
  it('the player cannot delete it', async () => {
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(guest(), E + 'g1')));
  });
  it('another player cannot update it', async () => {
    await assertFails(updateDoc(doc(other(), E + 'g1'), { name: 'Hacked' }));
  });
  it('the owner can still read it; another player cannot', async () => {
    await assertSucceeds(getDoc(doc(guest(), E + 'g1')));
    await assertFails(getDoc(doc(other(), E + 'g1')));
  });
});
