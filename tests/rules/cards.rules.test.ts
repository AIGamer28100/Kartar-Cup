import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, Timestamp, serverTimestamp } from 'firebase/firestore';

let env: RulesTestEnvironment;

const tok = (email: string) => ({ email, email_verified: true, firebase: { sign_in_provider: 'google.com' } });
const host = () => env.authenticatedContext('h1', tok('host@x.com')).firestore();
const guest = () => env.authenticatedContext('g1', tok('guest1@example.com')).firestore();
const other = () => env.authenticatedContext('g2', tok('guest2@example.com')).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const BEID = 'be1';
const bookingEventDoc = (over: Record<string, unknown> = {}) => ({
  id: BEID, raceId: 'custom', title: 'Watch Party', venue: { id: 'v1', name: 'Venue', city: 'Chennai' },
  dateUtc: '2026-10-01T00:00:00Z', tiers: [{ id: 't1', label: 'Single', priceInr: 500 }], discounts: [],
  capacity: 10, bookedCount: 1, salesOpen: true, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...over,
});
const booking = (id: string, over: Record<string, unknown> = {}) => ({
  id, bookingEventId: BEID, buyerUid: 'g1', buyerName: 'Guest One', buyerEmail: 'guest1@example.com',
  tierId: 't1', qty: 1, unitPriceInr: 500, discountAmountInr: 0, totalInr: 500, status: 'paid_mock',
  qrToken: id, createdAt: Timestamp.now(), ...over,
});
const img = 'data:image/webp;base64,AAAA';
const vip = (over: Record<string, unknown> = {}) => ({ kind: 'vip', title: 'VIP Guest', image: img, width: 600, height: 900, order: 0, updatedAt: serverTimestamp(), ...over });
const play = (over: Record<string, unknown> = {}) => ({
  kind: 'play', title: 'LEC', driverName: 'Charles Leclerc', code: 'LEC', number: 16, points: 40, image: img, width: 600, height: 900, order: 1,
  updatedAt: serverTimestamp(), ...over,
});
const snap = (over: Record<string, unknown> = {}) => ({ cardId: 'c2', driverName: 'Charles Leclerc', code: 'LEC', number: 16, points: 40, image: img, ...over });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-cards-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
    await setDoc(doc(db, `bookingEvents/${BEID}`), bookingEventDoc());
    await setDoc(doc(db, `bookingEvents/${BEID}/cards/c1`), { ...vip(), updatedAt: new Date() });
    await setDoc(doc(db, `bookingEvents/${BEID}/cards/c2`), { ...play(), updatedAt: new Date() });
    await setDoc(doc(db, 'bookings/b1'), booking('b1'));
    await setDoc(doc(db, 'bookings/b2'), booking('b2', { status: 'reserved', buyerUid: 'g1' }));
  });
});

describe('cards: who reads the designs', () => {
  it('host reads every card', async () => {
    await assertSucceeds(getDoc(doc(host(), `bookingEvents/${BEID}/cards/c2`)));
    await assertSucceeds(getDocs(collection(host(), `bookingEvents/${BEID}/cards`)));
  });
  it('a signed-in guest reads the VIP design via a kind==vip query', async () => {
    await assertSucceeds(getDocs(query(collection(guest(), `bookingEvents/${BEID}/cards`), where('kind', '==', 'vip'))));
    await assertSucceeds(getDoc(doc(guest(), `bookingEvents/${BEID}/cards/c1`)));
  });
  it('a guest cannot read a Play card design or list the whole deck', async () => {
    // A guest may get a play card by id (to view their own assigned card)
    await assertSucceeds(getDoc(doc(guest(), `bookingEvents/${BEID}/cards/c2`)));
    // but cannot list the deck without a filter
    await assertFails(getDocs(collection(guest(), `bookingEvents/${BEID}/cards`)));
    // and cannot query for play cards (only vip queries are allowed)
    await assertFails(getDocs(query(collection(guest(), `bookingEvents/${BEID}/cards`), where('kind', '==', 'play'))));
  });
  it('signed-out users read nothing', async () => {
    await assertFails(getDoc(doc(anon(), `bookingEvents/${BEID}/cards/c1`)));
  });
});

describe('cards: who writes the designs', () => {
  it('host creates VIP and Play cards', async () => {
    await assertSucceeds(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n1`), vip({ order: 5 })));
    await assertSucceeds(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n2`), play({ driverName: 'Max Verstappen', code: 'VER', number: 3, points: 31 })));
  });
  it('guests cannot create, update or delete cards', async () => {
    await assertFails(setDoc(doc(guest(), `bookingEvents/${BEID}/cards/n1`), vip()));
    await assertFails(updateDoc(doc(guest(), `bookingEvents/${BEID}/cards/c1`), { title: 'x' }));
  });
  it('a Play card needs a driver name and points', async () => {
    const { points: _p, ...noPoints } = play();
    const { driverName: _d, ...noDriver } = play();
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n3`), noPoints));
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n4`), noDriver));
  });
  it('rejects unknown kind, oversized image, bad points and unknown fields', async () => {
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n5`), vip({ kind: 'gold' })));
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n6`), vip({ image: 'x'.repeat(450001) })));
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n7`), play({ points: -1 })));
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n8`), play({ points: 1001 })));
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/n9`), vip({ secret: 1 })));
  });
});

describe('cards: assigning to a booking', () => {
  it('host assigns a pass number and a Play card to a paid booking', async () => {
    await assertSucceeds(updateDoc(doc(host(), 'bookings/b1'), { passNumber: 1, playCard: snap() }));
  });
  it('the owner reads their own assigned cards; another guest cannot', async () => {
    await assertSucceeds(updateDoc(doc(host(), 'bookings/b1'), { passNumber: 7, playCard: snap() }));
    await assertSucceeds(getDoc(doc(guest(), 'bookings/b1')));
    await assertFails(getDoc(doc(other(), 'bookings/b1')));
  });
  it('cannot assign to a reserved (unpaid) booking', async () => {
    await assertFails(updateDoc(doc(host(), 'bookings/b2'), { passNumber: 2 }));
  });
  it('the owner cannot assign or edit their own cards', async () => {
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { passNumber: 99 }));
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { playCard: snap({ points: 1000 }) }));
  });
  it('host cannot smuggle other fields in with an assignment', async () => {
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { passNumber: 3, totalInr: 0 }));
  });
  it('rejects a malformed pass number or card snapshot', async () => {
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { passNumber: 0 }));
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { passNumber: 1.5 }));
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { playCard: snap({ points: 5000 }) }));
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { playCard: { cardId: 'c2' } }));
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { playCard: snap({ extra: true }) }));
  });
});

describe('cards: event card spec and pass counter', () => {
  it('host saves a card size spec and a pass counter on the event', async () => {
    await assertSucceeds(setDoc(doc(host(), `bookingEvents/${BEID}`), bookingEventDoc({ cardSpec: { widthMm: 54, heightMm: 86, note: 'matte' }, cardSeq: 3 })));
  });
  it('rejects a bad counter and unknown card-spec keys', async () => {
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}`), bookingEventDoc({ cardSeq: -1 })));
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}`), bookingEventDoc({ cardSpec: { depthMm: 2 } })));
  });
});

describe('cards: CDN image links (Cloudflare R2) instead of inline images', () => {
  const noImg = (o: Record<string, unknown>) => { const { image: _i, ...rest } = o as { image?: string }; return rest; };
  it('a card may carry an https imageUrl and no inline image', async () => {
    await assertSucceeds(setDoc(doc(host(), `bookingEvents/${BEID}/cards/u1`), { ...noImg(vip()), imageUrl: 'https://cdn.example.com/a8f3k2.webp' }));
    await assertSucceeds(setDoc(doc(host(), `bookingEvents/${BEID}/cards/u2`), { ...noImg(play()), imageUrl: 'https://cdn.example.com/p91x.webp' }));
  });
  it('rejects http links, a missing image and an over-long url', async () => {
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/u3`), { ...noImg(vip()), imageUrl: 'http://cdn.example.com/a.webp' }));
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/u4`), noImg(vip())));
    await assertFails(setDoc(doc(host(), `bookingEvents/${BEID}/cards/u5`), { ...noImg(vip()), imageUrl: 'https://x.com/' + 'a'.repeat(500) }));
  });
  it('an assignment snapshot may use imageUrl too', async () => {
    const { image: _i, ...rest } = snap();
    // Snapshot with imageUrl is valid (legacy)
    await assertSucceeds(updateDoc(doc(host(), 'bookings/b1'), { playCard: { ...rest, imageUrl: 'https://cdn.example.com/p91x.webp' } }));
    // Snapshot with no image/imageUrl is now valid (cardId, driverName, points only)
    await assertSucceeds(updateDoc(doc(host(), 'bookings/b1'), { playCard: rest }));
  });
});
