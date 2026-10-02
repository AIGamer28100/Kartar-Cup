import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';

let env: RulesTestEnvironment;

const tok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const host = () => env.authenticatedContext('h1', tok('host@x.com')).firestore();
const guest = () => env.authenticatedContext('g1', tok('guest1@example.com')).firestore();
const anon = () => env.unauthenticatedContext().firestore();
// A venue_host runs bookings only: must NOT be able to edit the Cup.
const venueHost = () => env.authenticatedContext('v1', tok('venue@x.com')).firestore();

const SID = 's1';
const season = (over: Record<string, unknown> = {}) => ({
  name: 'Season One', year: 2026, status: 'active', pointsTable: [25, 18, 15], fastestLapBonus: 0,
  published: true, updatedAt: serverTimestamp(), ...over,
});
const round = (over: Record<string, unknown> = {}) => ({
  name: 'Round 1', date: '2026-05-01', order: 1, status: 'completed', published: true, ...over,
});
const driver = (over: Record<string, unknown> = {}) => ({ name: 'Driver A', active: true, ...over });
const result = (over: Record<string, unknown> = {}) => ({ order: ['d1'], dnf: [], updatedAt: serverTimestamp(), ...over });
const standings = (over: Record<string, unknown> = {}) => ({
  drivers: [], teams: [], roundsCounted: 0, updatedAt: serverTimestamp(), ...over,
});

async function seed(opts: { seasonPublished?: boolean; roundPublished?: boolean } = {}) {
  const { seasonPublished = true, roundPublished = true } = opts;
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
    await setDoc(doc(db, 'users/v1'), { roles: ['venue_host'] });
    await setDoc(doc(db, `cupSeasons/${SID}`), { ...season({ published: seasonPublished }), updatedAt: new Date() });
    await setDoc(doc(db, `cupSeasons/${SID}/drivers/d1`), driver());
    await setDoc(doc(db, `cupSeasons/${SID}/rounds/r1`), round({ published: roundPublished }));
    await setDoc(doc(db, `cupSeasons/${SID}/rounds/r1/results/final`), { order: ['d1'], dnf: [], updatedAt: new Date() });
    await setDoc(doc(db, `cupSeasons/${SID}/standings/current`), { drivers: [], teams: [], roundsCounted: 0, updatedAt: new Date() });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-cup-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe('cup: public reads of published data', () => {
  it('anyone reads a published season, its drivers, rounds, results and standings', async () => {
    for (const c of [anon(), guest()]) {
      await assertSucceeds(getDoc(doc(c, `cupSeasons/${SID}`)));
      await assertSucceeds(getDoc(doc(c, `cupSeasons/${SID}/drivers/d1`)));
      await assertSucceeds(getDoc(doc(c, `cupSeasons/${SID}/rounds/r1`)));
      await assertSucceeds(getDoc(doc(c, `cupSeasons/${SID}/rounds/r1/results/final`)));
      await assertSucceeds(getDoc(doc(c, `cupSeasons/${SID}/standings/current`)));
    }
  });
  it('public may list with the published filter', async () => {
    await assertSucceeds(getDocs(query(collection(anon(), 'cupSeasons'), where('published', '==', true))));
    await assertSucceeds(getDocs(query(collection(anon(), `cupSeasons/${SID}/rounds`), where('published', '==', true))));
    await assertSucceeds(getDocs(collection(anon(), `cupSeasons/${SID}/drivers`)));
  });
  it('public cannot list seasons or rounds without the published filter', async () => {
    await assertFails(getDocs(collection(anon(), 'cupSeasons')));
    await assertFails(getDocs(collection(anon(), `cupSeasons/${SID}/rounds`)));
  });
});

describe('cup: unpublished is host-only', () => {
  it('unpublished season and everything under it is hidden from guests', async () => {
    await seed({ seasonPublished: false });
    for (const c of [anon(), guest()]) {
      await assertFails(getDoc(doc(c, `cupSeasons/${SID}`)));
      await assertFails(getDoc(doc(c, `cupSeasons/${SID}/drivers/d1`)));
      await assertFails(getDoc(doc(c, `cupSeasons/${SID}/rounds/r1`)));
      await assertFails(getDoc(doc(c, `cupSeasons/${SID}/rounds/r1/results/final`)));
      await assertFails(getDoc(doc(c, `cupSeasons/${SID}/standings/current`)));
    }
    await assertFails(getDocs(query(collection(anon(), 'cupSeasons'), where('published', '==', false))));
  });
  it('unpublished round and its results are hidden even when the season is published', async () => {
    await seed({ roundPublished: false });
    await assertFails(getDoc(doc(guest(), `cupSeasons/${SID}/rounds/r1`)));
    await assertFails(getDoc(doc(guest(), `cupSeasons/${SID}/rounds/r1/results/final`)));
    await assertSucceeds(getDoc(doc(guest(), `cupSeasons/${SID}`)));
  });
  it('host reads unpublished data', async () => {
    await seed({ seasonPublished: false, roundPublished: false });
    await assertSucceeds(getDoc(doc(host(), `cupSeasons/${SID}`)));
    await assertSucceeds(getDoc(doc(host(), `cupSeasons/${SID}/rounds/r1`)));
    await assertSucceeds(getDoc(doc(host(), `cupSeasons/${SID}/rounds/r1/results/final`)));
    await assertSucceeds(getDocs(collection(host(), 'cupSeasons')));
  });
});

describe('cup: writes', () => {
  it('guest, anonymous and venue_host cannot write anything', async () => {
    for (const c of [anon(), guest(), venueHost()]) {
      await assertFails(setDoc(doc(c, `cupSeasons/${SID}`), season()));
      await assertFails(setDoc(doc(c, `cupSeasons/${SID}/drivers/d2`), driver()));
      await assertFails(setDoc(doc(c, `cupSeasons/${SID}/rounds/r2`), round()));
      await assertFails(setDoc(doc(c, `cupSeasons/${SID}/rounds/r1/results/final`), result()));
      await assertFails(setDoc(doc(c, `cupSeasons/${SID}/standings/current`), standings()));
      await assertFails(deleteDoc(doc(c, `cupSeasons/${SID}/drivers/d1`)));
    }
  });
  it('host writes valid season, driver, round, result and standings', async () => {
    const h = host();
    await assertSucceeds(setDoc(doc(h, 'cupSeasons/s2'), season({ published: false })));
    await assertSucceeds(setDoc(doc(h, `cupSeasons/${SID}`), season({ name: 'Renamed' })));
    await assertSucceeds(setDoc(doc(h, `cupSeasons/${SID}/drivers/d2`), driver({ number: 7, team: 'Red' })));
    await assertSucceeds(setDoc(doc(h, `cupSeasons/${SID}/rounds/r2`), round({ venue: 'Track', status: 'scheduled' })));
    await assertSucceeds(setDoc(doc(h, `cupSeasons/${SID}/rounds/r2/results/final`), result({ fastestLap: 'd1' })));
    await assertSucceeds(setDoc(doc(h, `cupSeasons/${SID}/standings/current`), standings({ roundsCounted: 1 })));
  });
  it('host may delete drivers and rounds but never a season', async () => {
    await assertSucceeds(deleteDoc(doc(host(), `cupSeasons/${SID}/drivers/d1`)));
    await assertSucceeds(deleteDoc(doc(host(), `cupSeasons/${SID}/rounds/r1`)));
    await assertFails(deleteDoc(doc(host(), `cupSeasons/${SID}`)));
  });
  it('standings only at standings/current', async () => {
    await assertFails(setDoc(doc(host(), `cupSeasons/${SID}/standings/other`), standings()));
    await assertFails(setDoc(doc(host(), `cupSeasons/${SID}/rounds/r1/results/other`), result()));
  });
});

describe('cup: malformed writes are rejected', () => {
  const h = () => host();
  it('season', async () => {
    const p = `cupSeasons/${SID}`;
    await assertFails(setDoc(doc(h(), p), season({ extra: 1 })));
    await assertFails(setDoc(doc(h(), p), season({ name: '' })));
    await assertFails(setDoc(doc(h(), p), season({ name: 'x'.repeat(81) })));
    await assertFails(setDoc(doc(h(), p), season({ year: '2026' })));
    await assertFails(setDoc(doc(h(), p), season({ year: 1999 })));
    await assertFails(setDoc(doc(h(), p), season({ status: 'weird' })));
    await assertFails(setDoc(doc(h(), p), season({ published: 'yes' })));
    await assertFails(setDoc(doc(h(), p), season({ fastestLapBonus: 11 })));
    await assertFails(setDoc(doc(h(), p), season({ fastestLapBonus: -1 })));
    await assertFails(setDoc(doc(h(), p), season({ pointsTable: [] })));
    await assertFails(setDoc(doc(h(), p), season({ pointsTable: new Array(21).fill(1) })));
    await assertFails(setDoc(doc(h(), p), season({ pointsTable: [25, 'x'] })));
    await assertFails(setDoc(doc(h(), p), season({ pointsTable: [25, -1] })));
    await assertFails(setDoc(doc(h(), p), season({ pointsTable: [25, 1001] })));
    await assertFails(setDoc(doc(h(), p), season({ pointsTable: 'nope' })));
    await assertFails(setDoc(doc(h(), p), season({ updatedAt: new Date('2020-01-01') })));
    const { updatedAt: _u, ...noStamp } = season();
    void _u;
    await assertFails(setDoc(doc(h(), p), noStamp));
  });
  it('season accepts the 20-position maximum', async () => {
    await assertSucceeds(setDoc(doc(h(), `cupSeasons/${SID}`), season({ pointsTable: new Array(20).fill(1) })));
  });
  it('driver', async () => {
    const p = `cupSeasons/${SID}/drivers/dx`;
    await assertFails(setDoc(doc(h(), p), driver({ extra: 1 })));
    await assertFails(setDoc(doc(h(), p), driver({ name: '' })));
    await assertFails(setDoc(doc(h(), p), driver({ name: 'x'.repeat(61) })));
    await assertFails(setDoc(doc(h(), p), driver({ number: 1000 })));
    await assertFails(setDoc(doc(h(), p), driver({ number: 'a' })));
    await assertFails(setDoc(doc(h(), p), driver({ team: '' })));
    await assertFails(setDoc(doc(h(), p), driver({ active: 'y' })));
    await assertFails(setDoc(doc(h(), p), { name: 'No active flag' }));
  });
  it('round', async () => {
    const p = `cupSeasons/${SID}/rounds/rx`;
    await assertFails(setDoc(doc(h(), p), round({ extra: 1 })));
    await assertFails(setDoc(doc(h(), p), round({ date: '1 May 2026' })));
    await assertFails(setDoc(doc(h(), p), round({ date: 20260501 })));
    await assertFails(setDoc(doc(h(), p), round({ status: 'live' })));
    await assertFails(setDoc(doc(h(), p), round({ order: 'one' })));
    await assertFails(setDoc(doc(h(), p), round({ order: 1001 })));
    await assertFails(setDoc(doc(h(), p), round({ name: '' })));
    await assertFails(setDoc(doc(h(), p), round({ venue: 'x'.repeat(81) })));
    await assertFails(setDoc(doc(h(), p), round({ published: 1 })));
  });
  it('result', async () => {
    const p = `cupSeasons/${SID}/rounds/r1/results/final`;
    await assertFails(setDoc(doc(h(), p), result({ extra: 1 })));
    await assertFails(setDoc(doc(h(), p), result({ order: 'd1' })));
    await assertFails(setDoc(doc(h(), p), result({ order: new Array(101).fill('x') })));
    await assertFails(setDoc(doc(h(), p), result({ dnf: 'd1' })));
    await assertFails(setDoc(doc(h(), p), result({ fastestLap: 5 })));
    await assertFails(setDoc(doc(h(), p), result({ updatedAt: new Date('2020-01-01') })));
  });
  it('standings', async () => {
    const p = `cupSeasons/${SID}/standings/current`;
    await assertFails(setDoc(doc(h(), p), standings({ extra: 1 })));
    await assertFails(setDoc(doc(h(), p), standings({ drivers: 'x' })));
    await assertFails(setDoc(doc(h(), p), standings({ drivers: new Array(101).fill({}) })));
    await assertFails(setDoc(doc(h(), p), standings({ roundsCounted: 'x' })));
    await assertFails(setDoc(doc(h(), p), { drivers: [], roundsCounted: 0, updatedAt: serverTimestamp() }));
  });
});
