import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, Timestamp, serverTimestamp, writeBatch } from 'firebase/firestore';

let env: RulesTestEnvironment;

const HOST_TOKEN = {
  email: 'host@x.com',
  email_verified: true,
  firebase: { sign_in_provider: 'google.com' },
};
const gtok = (email = 'guest1@example.com', extra: Record<string, unknown> = {}) => ({
  email, email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra,
});
const guest = (uid = 'g1', email = 'guest1@example.com') => env.authenticatedContext(uid, gtok(email)).firestore();
const other = () => env.authenticatedContext('g2', gtok('guest2@example.com')).firestore();
const host = () => env.authenticatedContext('h1', HOST_TOKEN).firestore(); // hosts/ doc: a SUPER ADMIN
// Role-based staff (users/{uid}.roles), seeded in seed() below. R54-R56.
const roleCtx = (uid: string, email: string) => env.authenticatedContext(uid, gtok(email)).firestore();
const adminRole = () => roleCtx('a1', 'admin@x.com');
const hostRole = () => roleCtx('hr1', 'hostrole@x.com');
const venueRole = () => roleCtx('v1', 'venue@x.com');
const marketer = () => roleCtx('m1', 'mkt@x.com');
const userDoc = (uid: string, email: string, roles: string[]) => ({
  uid, email, name: email.split('@')[0], createdAt: Timestamp.now(), lastSeenAt: Timestamp.now(), roles,
});

const BEID = 'be1';
const venue = { id: 'v1', name: 'Venue', city: 'Chennai' };
const tiers = [{ id: 't1', label: 'Single', priceInr: 500 }, { id: 't2', label: 'Duo', priceInr: 900 }];

const bookingEventDoc = (over: Record<string, unknown> = {}) => ({
  id: BEID, raceId: 'custom', title: 'Watch Party', venue, dateUtc: '2026-10-01T00:00:00Z',
  dateMs: Date.now() + 30 * 86_400_000, // R56: far in the future, so refunds are open unless a test says otherwise
  tiers, discounts: [], capacity: 10, bookedCount: 0, salesOpen: true,
  createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...over,
});

async function seed(over: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'bookingEvents/' + BEID), bookingEventDoc(over));
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
    await setDoc(doc(db, 'users/a1'), userDoc('a1', 'admin@x.com', ['admin']));
    await setDoc(doc(db, 'users/hr1'), userDoc('hr1', 'hostrole@x.com', ['host']));
    await setDoc(doc(db, 'users/v1'), userDoc('v1', 'venue@x.com', ['venue_host']));
    await setDoc(doc(db, 'users/m1'), userDoc('m1', 'mkt@x.com', ['marketing']));
  });
}

const booking = (id: string, over: Record<string, unknown> = {}) => ({
  id, bookingEventId: BEID, buyerUid: 'g1', buyerName: 'Guest One', buyerEmail: 'guest1@example.com',
  tierId: 't1', tierIndex: 0, qty: 1, seatsPerTicket: 1, unitPriceInr: 500, discountAmountInr: 0, totalInr: 500, status: 'reserved',
  qrToken: `tok-${id}-0123456789abcdefghij`, createdAt: serverTimestamp(), ...over,
});

async function seedBooking(id: string, over: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'bookings/' + id), booking(id, over));
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'kartar-cup-bookings-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});
afterAll(async () => { await env.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await seed(); });

describe('bookingEvents read', () => {
  it('public read when salesOpen', async () => {
    await assertSucceeds(getDoc(doc(guest(), 'bookingEvents/' + BEID)));
  });
  it('denied when closed for a guest', async () => {
    await seed({ salesOpen: false });
    await assertFails(getDoc(doc(guest(), 'bookingEvents/' + BEID)));
  });
  it('host always reads', async () => {
    await seed({ salesOpen: false });
    await assertSucceeds(getDoc(doc(host(), 'bookingEvents/' + BEID)));
  });
  it('guest can list only salesOpen==true events', async () => {
    await assertSucceeds(getDocs(query(collection(guest(), 'bookingEvents'), where('salesOpen', '==', true))));
  });
  it('guest listing closed events is denied outright', async () => {
    await seed({ salesOpen: false });
    await assertFails(getDocs(collection(guest(), 'bookingEvents')));
  });
});

describe('bookingEvents hosted-but-closed (R49)', () => {
  it('guest reads a closed event only when hosted==true', async () => {
    await seed({ salesOpen: false, hosted: true });
    await assertSucceeds(getDoc(doc(guest(), 'bookingEvents/' + BEID)));
  });
  it('hosted:false and legacy (no hosted field) closed events stay private', async () => {
    await seed({ salesOpen: false, hosted: false });
    await assertFails(getDoc(doc(guest(), 'bookingEvents/' + BEID)));
    await seed({ salesOpen: false });
    await assertFails(getDoc(doc(guest(), 'bookingEvents/' + BEID)));
  });
  it('guest can list where hosted==true; unfiltered list is still denied', async () => {
    await seed({ salesOpen: false, hosted: true });
    await assertSucceeds(getDocs(query(collection(guest(), 'bookingEvents'), where('hosted', '==', true))));
    await assertFails(getDocs(collection(guest(), 'bookingEvents')));
  });
  it('a hosted-but-closed event cannot be reserved (salesOpen still gates booking)', async () => {
    await seed({ salesOpen: false, hosted: true });
    await assertFails(setDoc(doc(guest(), 'bookings/r1'), booking('r1')));
  });
  it('closed hosted listing never exposes bookings (R15)', async () => {
    await seed({ salesOpen: false, hosted: true });
    await seedBooking('b1');
    await assertFails(getDoc(doc(other(), 'bookings/b1')));
    await assertFails(getDocs(collection(other(), 'bookings')));
  });
});

describe('bookingEvents category/hosted/description validation (R50)', () => {
  const put = (over: Record<string, unknown>) => setDoc(doc(host(), 'bookingEvents/' + BEID), bookingEventDoc(over));
  it('accepts f1/cup/club, hosted bool, description', async () => {
    await assertSucceeds(put({ category: 'cup', hosted: true, description: 'Kart night' }));
    await assertSucceeds(put({ category: 'club', hosted: false }));
    await assertSucceeds(put({ category: 'f1' }));
  });
  it('legacy doc without category/hosted still valid', async () => {
    await assertSucceeds(put({}));
  });
  it('rejects unknown category, non-bool hosted, long description', async () => {
    await assertFails(put({ category: 'other' }));
    await assertFails(put({ hosted: 'yes' }));
    await assertFails(put({ description: 'x'.repeat(601) }));
  });
  it('guest cannot set category', async () => {
    await assertFails(setDoc(doc(guest(), 'bookingEvents/' + BEID), bookingEventDoc({ category: 'cup' })));
  });
});

describe('bookingEvents write', () => {
  it('host can create/update', async () => {
    await assertSucceeds(setDoc(doc(host(), 'bookingEvents/' + BEID), bookingEventDoc({ capacity: 20 })));
  });
  it('guest cannot write', async () => {
    await assertFails(setDoc(doc(guest(), 'bookingEvents/' + BEID), bookingEventDoc({ capacity: 20 })));
  });
  it('rejects non-positive capacity', async () => {
    await assertFails(setDoc(doc(host(), 'bookingEvents/' + BEID), bookingEventDoc({ capacity: 0 })));
  });
  it('rejects negative tier price', async () => {
    await assertFails(setDoc(doc(host(), 'bookingEvents/' + BEID),
      bookingEventDoc({ tiers: [{ id: 't1', label: 'Single', priceInr: -1 }] })));
  });
  it('rejects title over 120 chars', async () => {
    await assertFails(setDoc(doc(host(), 'bookingEvents/' + BEID), bookingEventDoc({ title: 'x'.repeat(121) })));
  });
  it('rejects more than 10 tiers or 20 discounts', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => ({ id: 't' + i, label: 'x', priceInr: 1 }));
    await assertFails(setDoc(doc(host(), 'bookingEvents/' + BEID), bookingEventDoc({ tiers: many(11) })));
    await assertFails(setDoc(doc(host(), 'bookingEvents/' + BEID),
      bookingEventDoc({ discounts: Array.from({ length: 21 }, (_, i) => ({ id: 'd' + i })) })));
  });
});

describe('bookingEvents quizEventId (R57)', () => {
  const evRef = (db: ReturnType<typeof guest>) => doc(db, 'bookingEvents/' + BEID);
  const link = (db: ReturnType<typeof guest>, quizEventId: unknown) =>
    updateDoc(evRef(db), { quizEventId, updatedAt: serverTimestamp() });
  const AUTO_ID = 'Zk3PqR9xT1mVb7LwN2cA'; // a Firestore auto-id, not a race id

  it('whoever may edit the event may link its quiz (super admin, admin, host, venue_host)', async () => {
    await assertSucceeds(link(host(), AUTO_ID));
    await assertSucceeds(link(adminRole(), AUTO_ID));
    await assertSucceeds(link(hostRole(), AUTO_ID));
    await assertSucceeds(link(venueRole(), AUTO_ID));
  });
  it('guests and marketing cannot set it', async () => {
    await assertFails(link(guest(), AUTO_ID));
    await assertFails(link(marketer(), AUTO_ID));
  });
  it('must be a non-empty string of at most 60 characters', async () => {
    await assertFails(link(hostRole(), ''));
    await assertFails(link(hostRole(), 'x'.repeat(61)));
    await assertFails(link(hostRole(), 42));
    await assertFails(link(hostRole(), null));
    await assertSucceeds(link(hostRole(), 'x'.repeat(60)));
  });
  it('is accepted on create, and a legacy doc without it stays valid', async () => {
    await assertSucceeds(setDoc(evRef(hostRole()), bookingEventDoc({ quizEventId: AUTO_ID })));
    await assertSucceeds(setDoc(evRef(hostRole()), bookingEventDoc()));
  });
  it('linking does not unlock the seat counter (R54 pin still holds)', async () => {
    await assertFails(updateDoc(evRef(hostRole()), { quizEventId: AUTO_ID, bookedCount: 5, updatedAt: serverTimestamp() }));
  });
  it('stays inside the evaluation budget on a 5-tier event for a role-based host', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: 't' + i, label: 'Tier ' + i, priceInr: 100 }));
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ tiers: many, discounts: [] }));
    });
    await assertSucceeds(updateDoc(evRef(hostRole()), { quizEventId: AUTO_ID, updatedAt: serverTimestamp() }));
  });
});

// A4: the host UI allows MAX_TIERS (10) tiers, each written with capacity + seatsPerTicket. A plain
// role-based `host` (users/{uid}.roles, so every hasRole() costs a document read and several
// expressions) must be able to save such an event inside the 1000-expression budget.
describe('10-tier event inside the evaluation budget (A4)', () => {
  const tenTiers = Array.from({ length: 10 }, (_, i) => ({
    id: 'tier-' + (i + 1), label: 'Tier number ' + (i + 1), priceInr: 100 * (i + 1), capacity: 5, seatsPerTicket: 1 + (i % 3),
  }));
  const tenDiscounts = Array.from({ length: 20 }, (_, i) => ({ id: 'd' + i, label: 'D' + i, kind: 'flat', value: 10, active: true, code: 'CODE' + i }));
  const full = (over: Record<string, unknown> = {}) => bookingEventDoc({
    tiers: tenTiers, discounts: tenDiscounts, category: 'f1', hosted: true, description: 'x'.repeat(600),
    policy: 'p'.repeat(300), refundCutoffMin: 60, quizEventId: 'q1', ...over,
  });
  const ref = (db: ReturnType<typeof guest>) => doc(db, 'bookingEvents/' + BEID);
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(ref(c.firestore() as never), full({ bookedCount: 3 })); });
  });

  it('a role-based host saves the whole 10-tier event (the host form write)', async () => {
    await assertSucceeds(setDoc(ref(hostRole()), { ...full({ bookedCount: 3, title: 'Renamed' }), updatedAt: serverTimestamp() }));
  });
  it('a role-based host edits one field of a 10-tier event', async () => {
    await assertSucceeds(updateDoc(ref(hostRole()), { title: 'Renamed', updatedAt: serverTimestamp() }));
  });
  it('a venue_host and an admin can save it too', async () => {
    await assertSucceeds(updateDoc(ref(venueRole()), { salesOpen: false, updatedAt: serverTimestamp() }));
    await assertSucceeds(setDoc(ref(adminRole()), { ...full({ bookedCount: 3, refundCutoffMin: 90 }), updatedAt: serverTimestamp() }));
  });
  // Validating ALL 10 tiers in a SINGLE write still exceeds the budget for a role-based host (about 60 per full
  // tier on top of ~470 for a create). The client therefore saves in chunks of 5 changed tiers (src/lib/tierChunks.ts,
  // createBookingEvent / updateBookingEvent) and the rules only validate tiers that CHANGED, so each step fits.
  it('a role-based host builds a 10-tier event in two writes: create with 5 tiers, then add 5 more', async () => {
    // refundCutoffMin is admin-only (R56), so the host form never sends it.
    const { refundCutoffMin: _r, ...rest } = full({ id: 'be2', bookedCount: 0, salesOpen: false });
    void _r;
    await assertSucceeds(setDoc(doc(hostRole(), 'bookingEvents/be2'), { ...rest, tiers: tenTiers.slice(0, 5) }));
    await assertSucceeds(setDoc(doc(hostRole(), 'bookingEvents/be2'), { ...rest, tiers: tenTiers, salesOpen: true, updatedAt: serverTimestamp() }));
  });
  it('a role-based host cancels a 10-tier event', async () => {
    await assertSucceeds(updateDoc(ref(hostRole()), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'hostrole@x.com', updatedAt: serverTimestamp(),
    }));
  });
  it('the last tier is still validated (bad tier 10 refused)', async () => {
    const bad = tenTiers.map((t, i) => (i === 9 ? { ...t, priceInr: -1 } : t));
    await assertFails(updateDoc(ref(hostRole()), { tiers: bad, updatedAt: serverTimestamp() }));
    const bad2 = tenTiers.map((t, i) => (i === 9 ? { ...t, seatsPerTicket: 11 } : t));
    await assertFails(updateDoc(ref(hostRole()), { tiers: bad2, updatedAt: serverTimestamp() }));
    const bad3 = tenTiers.map((t, i) => (i === 9 ? { id: t.id, label: t.label } : t));
    await assertFails(updateDoc(ref(hostRole()), { tiers: bad3, updatedAt: serverTimestamp() }));
  });
  it('a role-based host cancels a paid booking of a 10-tier event (release batch)', async () => {
    await seedBooking('p1', { status: 'paid_mock', paidAt: Timestamp.now() });
    const db = hostRole();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/p1'), { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: 'hostrole@x.com', refund: 'mock_refunded' });
    b.update(ref(db), { bookedCount: 2, lastReleaseBookingId: 'p1', updatedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
});

const countDoc = (db: ReturnType<typeof guest>, tierId = 't1') => doc(db, `bookingEvents/${BEID}/tierCounts/${tierId}`);

// Like createReservation(): the booking, the seat bump and the tier counter bump commit together.
async function reserveBatch(id: string, over: Record<string, unknown> = {}, opts: { bump?: number; tierBump?: number; skipTier?: boolean } = {}) {
  const db = guest();
  const ev = (await getDoc(doc(db, 'bookingEvents/' + BEID))).data() as { bookedCount: number };
  const tierId = (over.tierId as string | undefined) ?? 't1';
  const cur = await getDoc(countDoc(db, tierId));
  const sold = cur.exists() ? (cur.data().booked as number) : 0;
  const qty = (over.qty as number | undefined) ?? 1;
  const seats = (over.seatsPerTicket as number | undefined) ?? 1;
  const b = writeBatch(db);
  b.set(doc(db, 'bookings/' + id), booking(id, over));
  b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: ev.bookedCount + (opts.bump ?? qty * seats), lastReserveBookingId: id, updatedAt: serverTimestamp() });
  if (!opts.skipTier) b.set(countDoc(db, tierId), { booked: sold + (opts.tierBump ?? qty), lastBookingId: id, updatedAt: serverTimestamp() });
  return b.commit();
}

describe('reservation create', () => {
  it('owner creates own reservation (booking + matching seat bump)', async () => {
    await assertSucceeds(reserveBatch('b1'));
  });
  it('seat bump must equal qty x seatsPerTicket (no overselling by under-bumping)', async () => {
    await seed({ tiers: [{ id: 't1', label: 'Four', priceInr: 500, seatsPerTicket: 4 }] });
    await assertFails(reserveBatch('b1', { seatsPerTicket: 4 }, { bump: 1 }));
    await assertSucceeds(reserveBatch('b2', { seatsPerTicket: 4 }));
  });
  it('price must be the event tier price (prices differ per event)', async () => {
    await assertFails(reserveBatch('b1', { unitPriceInr: 1, totalInr: 1 }));
    await seed({ tiers: [{ id: 't1', label: 'Single', priceInr: 750 }] });
    await assertFails(reserveBatch('b1', { unitPriceInr: 500, totalInr: 500 }));
    await assertSucceeds(reserveBatch('b2', { unitPriceInr: 750, totalInr: 750 }));
  });
  it('tierIndex must point at the named tier', async () => {
    await assertFails(reserveBatch('b1', { tierIndex: 1 }));
    await assertFails(reserveBatch('b1', { tierIndex: 7 }));
    await assertSucceeds(reserveBatch('b2', { tierId: 't2', tierIndex: 1, unitPriceInr: 900, totalInr: 900 }));
  });
  it('tier capacity is enforced and the counter must rise by exactly qty', async () => {
    await seed({ tiers: [{ id: 't1', label: 'Single', priceInr: 500, capacity: 2 }], capacity: 10 });
    await assertFails(reserveBatch('b1', {}, { skipTier: true }));
    await assertFails(reserveBatch('b1', {}, { tierBump: 2 }));
    await assertSucceeds(reserveBatch('b2', { qty: 2, totalInr: 1000 }));
    await assertFails(reserveBatch('b3'));
  });
  it('tier counters can only be raised by guests, never lowered or reset', async () => {
    await assertSucceeds(reserveBatch('b1'));
    await assertFails(setDoc(countDoc(guest()), { booked: 0, updatedAt: serverTimestamp() }));
    // Not even a super admin may lower it by hand: only as part of a cancel / release (see the R54 block).
    await assertFails(setDoc(countDoc(host()), { booked: 0, updatedAt: serverTimestamp() }));
  });
  it('a seat or tier bump without a booking of the caller is denied (no sell-out griefing)', async () => {
    await seed({ capacity: 500 });
    await assertFails(setDoc(countDoc(guest()), { booked: 1, updatedAt: serverTimestamp() }));
    await assertFails(setDoc(countDoc(guest()), { booked: 1, lastBookingId: 'ghost', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), { bookedCount: 5, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), { bookedCount: 5, lastReserveBookingId: 'ghost', updatedAt: serverTimestamp() }));
  });
  it('a bump cannot ride on someone else\'s booking or reuse an existing one', async () => {
    await seedBooking('b1'); // already exists, owned by g1
    const g = guest();
    const batch = writeBatch(g);
    batch.update(doc(g, 'bookingEvents/' + BEID), { bookedCount: 1, lastReserveBookingId: 'b1', updatedAt: serverTimestamp() });
    await assertFails(batch.commit());
    const o = other();
    const b2 = writeBatch(o);
    b2.set(doc(o, 'bookings/b9'), booking('b9')); // buyerUid g1, written by g2
    b2.update(doc(o, 'bookingEvents/' + BEID), { bookedCount: 1, lastReserveBookingId: 'b9', updatedAt: serverTimestamp() });
    await assertFails(b2.commit());
  });
  describe('discounts', () => {
    const disc = { id: 'd1', code: 'EARLY', label: 'Early', kind: 'percent', value: 10, active: true };
    const withDisc = { discountCode: 'early', discountIndex: 0, discountAmountInr: 50, totalInr: 450 };
    it('a real discount from the event is accepted', async () => {
      await seed({ discounts: [disc] });
      await assertSucceeds(reserveBatch('b1', withDisc));
    });
    it('a wrong amount, unknown code, inactive code or discount without a code is rejected', async () => {
      await seed({ discounts: [disc] });
      await assertFails(reserveBatch('b1', { ...withDisc, discountAmountInr: 400, totalInr: 100 }));
      await assertFails(reserveBatch('b1', { ...withDisc, discountCode: 'NOPE' }));
      await assertFails(reserveBatch('b1', { discountAmountInr: 50, totalInr: 450 }));
      await seed({ discounts: [{ ...disc, active: false }] });
      await assertFails(reserveBatch('b1', withDisc));
    });
    it('flat discounts are exact', async () => {
      await seed({ discounts: [{ ...disc, kind: 'flat', value: 120 }] });
      await assertSucceeds(reserveBatch('b1', { ...withDisc, discountAmountInr: 120, totalInr: 380 }));
      await assertFails(reserveBatch('b2', { ...withDisc, discountAmountInr: 200, totalInr: 300 }));
    });
  });
  it('a booking without the seat bump is rejected', async () => {
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1')));
  });
  it('booking id must equal the document id', async () => {
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('other')));
  });
  it('denied for mismatched buyerUid', async () => {
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1', { buyerUid: 'g2' })));
  });
  it('denied for mismatched buyerEmail', async () => {
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1', { buyerEmail: 'other@example.com' })));
  });
  it('qty must be a positive int <= 10', async () => {
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1', { qty: 0 })));
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1', { qty: 11 })));
    await assertSucceeds(reserveBatch('b1', { qty: 10, unitPriceInr: 500, totalInr: 5000 }));
  });
  it('wrong initial status is rejected', async () => {
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1', { status: 'paid_mock' })));
  });
  it('denied when the booking event is not salesOpen (sold out / closed)', async () => {
    await seed({ salesOpen: false });
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1')));
  });
  it('cannot set checkedIn* fields at creation', async () => {
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1', { checkedInBy: 'x@x.com' })));
  });
  it('total must match unitPrice*qty - discount', async () => {
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('b1', { totalInr: 1 })));
  });
});

describe('markPaidMock', () => {
  it('owner can flip reserved -> paid_mock', async () => {
    await seedBooking('b1');
    await assertSucceeds(updateDoc(doc(guest(), 'bookings/b1'), { status: 'paid_mock', paidAt: serverTimestamp() }));
  });
  it('non-owner denied', async () => {
    await seedBooking('b1');
    await assertFails(updateDoc(doc(other(), 'bookings/b1'), { status: 'paid_mock', paidAt: Timestamp.now() }));
  });
  it('owner cannot skip straight to checked_in', async () => {
    await seedBooking('b1');
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { status: 'checked_in', paidAt: Timestamp.now() }));
  });
  it('owner cannot touch checkedIn* fields', async () => {
    await seedBooking('b1');
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'),
      { status: 'paid_mock', paidAt: Timestamp.now(), checkedInBy: 'g1' }));
  });
  it('wrong source status rejected', async () => {
    await seedBooking('b1', { status: 'cancelled' });
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { status: 'paid_mock', paidAt: Timestamp.now() }));
  });
});

describe('checkIn', () => {
  it('host checks in a paid booking', async () => {
    await seedBooking('b1', { status: 'paid_mock' });
    await assertSucceeds(updateDoc(doc(host(), 'bookings/b1'),
      { status: 'checked_in', checkedInAt: serverTimestamp(), checkedInBy: 'host@x.com' }));
  });
  it('host partially checks in a bundled booking (count, status stays paid_mock)', async () => {
    await seedBooking('b1', { status: 'paid_mock', qty: 1, seatsPerTicket: 4 });
    await assertSucceeds(updateDoc(doc(host(), 'bookings/b1'),
      { status: 'paid_mock', checkedInCount: 2, checkedInBy: 'host@x.com' }));
  });
  it('check-in count must be a sane positive int', async () => {
    await seedBooking('b1', { status: 'paid_mock', seatsPerTicket: 4 });
    await assertFails(updateDoc(doc(host(), 'bookings/b1'),
      { status: 'paid_mock', checkedInCount: 0, checkedInBy: 'host@x.com' }));
  });
  it('non-host cannot check in', async () => {
    await seedBooking('b1', { status: 'paid_mock' });
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'),
      { status: 'checked_in', checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' }));
  });
  it('cannot check in a reserved (unpaid) booking', async () => {
    await seedBooking('b1', { status: 'reserved' });
    await assertFails(updateDoc(doc(host(), 'bookings/b1'),
      { status: 'checked_in', checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' }));
  });
  it('cannot re-check-in an already checked-in booking', async () => {
    await seedBooking('b1', { status: 'checked_in', checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' });
    await assertFails(updateDoc(doc(host(), 'bookings/b1'),
      { status: 'checked_in', checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' }));
  });
  it('checkedInBy must match the acting host token email', async () => {
    await seedBooking('b1', { status: 'paid_mock' });
    await assertFails(updateDoc(doc(host(), 'bookings/b1'),
      { status: 'checked_in', checkedInAt: Timestamp.now(), checkedInBy: 'someoneelse@x.com' }));
  });
});

describe('read scoping (R15)', () => {
  it('guest cannot get another buyer\'s booking', async () => {
    await seedBooking('b1');
    await assertFails(getDoc(doc(other(), 'bookings/b1')));
  });
  it('owner can get own booking', async () => {
    await seedBooking('b1');
    await assertSucceeds(getDoc(doc(guest(), 'bookings/b1')));
  });
  it('guest cannot list all bookings unfiltered', async () => {
    await seedBooking('b1');
    await seedBooking('b2', { buyerUid: 'g2', buyerEmail: 'guest2@example.com' });
    await assertFails(getDocs(collection(guest(), 'bookings')));
  });
  it('guest can query own bookings via buyerUid filter', async () => {
    await seedBooking('b1');
    await seedBooking('b2', { buyerUid: 'g2', buyerEmail: 'guest2@example.com' });
    await assertSucceeds(getDocs(query(collection(guest(), 'bookings'), where('buyerUid', '==', 'g1'))));
  });
  it('guest cannot query someone else\'s uid', async () => {
    await seedBooking('b2', { buyerUid: 'g2', buyerEmail: 'guest2@example.com' });
    await assertFails(getDocs(query(collection(guest(), 'bookings'), where('buyerUid', '==', 'g2'))));
  });
  it('host can list all bookings for an event', async () => {
    await seedBooking('b1');
    await seedBooking('b2', { buyerUid: 'g2', buyerEmail: 'guest2@example.com' });
    await assertSucceeds(getDocs(query(collection(host(), 'bookings'), where('bookingEventId', '==', BEID))));
  });
});

describe('delete', () => {
  it('owner cannot delete a booking', async () => {
    await seedBooking('b1');
    await assertFails(deleteDoc(doc(guest(), 'bookings/b1')));
  });
  it('host cannot delete a booking', async () => {
    await seedBooking('b1');
    await assertFails(deleteDoc(doc(host(), 'bookings/b1')));
  });
});

describe('cancelBookingEvent (host only)', () => {
  it('host can cancel an event (close sales + mark cancelled)', async () => {
    await assertSucceeds(updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', updatedAt: serverTimestamp(),
    }));
  });
  it('host can add an optional cancelReason (max 300 chars)', async () => {
    await assertSucceeds(updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', cancelReason: 'Venue unavailable', updatedAt: serverTimestamp(),
    }));
    await assertFails(updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', cancelReason: 'x'.repeat(301), updatedAt: serverTimestamp(),
    }));
  });
  it('a cancelled event cannot be un-cancelled', async () => {
    await updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', updatedAt: serverTimestamp(),
    });
    await assertFails(updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      cancelled: false, updatedAt: serverTimestamp(),
    }));
  });
  it('a cancelled event cannot have salesOpen reopened', async () => {
    await updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', updatedAt: serverTimestamp(),
    });
    await assertFails(updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: true, updatedAt: serverTimestamp(),
    }));
  });
  it('cancelled=true with salesOpen=true is rejected', async () => {
    await assertFails(updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: true, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', updatedAt: serverTimestamp(),
    }));
  });
  it('a guest can read a cancelled event even when salesOpen and hosted are false', async () => {
    await updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', updatedAt: serverTimestamp(),
    });
    await assertSucceeds(getDoc(doc(guest(), 'bookingEvents/' + BEID)));
  });
  it('anonymous can read a cancelled event', async () => {
    const anon = () => env.unauthenticatedContext().firestore();
    await updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', updatedAt: serverTimestamp(),
    });
    await assertSucceeds(getDoc(doc(anon(), 'bookingEvents/' + BEID)));
  });
  it('host cannot delete a bookingEvent', async () => {
    await assertFails(deleteDoc(doc(host(), 'bookingEvents/' + BEID)));
  });
  it('nobody can delete a tierCounts doc', async () => {
    await seedBooking('b1');
    await assertFails(deleteDoc(doc(guest(), `bookingEvents/${BEID}/tierCounts/t1`)));
    await assertFails(deleteDoc(doc(host(), `bookingEvents/${BEID}/tierCounts/t1`)));
  });
});

describe('cancelBooking (host / host-control members only)', () => {
  const cf = (by: 'guest' | 'host', refund: 'mock_refunded' | 'none', extra: Record<string, unknown> = {}) => ({
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: by === 'host' ? 'host@x.com' : by, refund, ...extra,
  });
  const setCount = (n: number, over: Record<string, unknown> = {}) =>
    env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: n, ...over })); });
  const evUpd = (n: number, bid: unknown) => ({ bookedCount: n, lastReleaseBookingId: bid, updatedAt: serverTimestamp() });
  /** Cancel + seat release in one atomic batch, as the client transaction does. */
  async function cancelWithRelease(db: ReturnType<typeof guest>, id: string, fields: Record<string, unknown>, newCount: number) {
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/' + id), fields);
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(newCount, id));
    return b.commit();
  }

  it('a guest can never cancel, not even their own booking', async () => {
    await setCount(1);
    await seedBooking('b1');
    await assertFails(cancelWithRelease(guest(), 'b1', cf('guest', 'none'), 0));
    await assertFails(cancelWithRelease(guest(), 'b1', cf('host', 'none'), 0));
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), cf('guest', 'none')));
  });
  it('a guest cannot lower the seat counter or name a booking to release', async () => {
    await setCount(5);
    await seedBooking('b1', { status: 'cancelled', cancelledBy: 'host', refund: 'none', cancelledAt: Timestamp.now() });
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), { bookedCount: 4, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(4, 'b1')));
  });
  it('host cancels a reserved booking and releases its seats', async () => {
    await setCount(3);
    await seedBooking('b1', { qty: 2, totalInr: 1000 });
    await assertSucceeds(cancelWithRelease(host(), 'b1', cf('host', 'none', { cancelReason: 'Venue closed' }), 1));
  });
  it('host cancels a paid_mock booking with mock_refunded; the label must match the prior status', async () => {
    await setCount(2);
    await seedBooking('b1', { status: 'paid_mock', paidAt: Timestamp.now() });
    await assertFails(cancelWithRelease(host(), 'b1', cf('host', 'none'), 1));
    await assertSucceeds(cancelWithRelease(host(), 'b1', cf('host', 'mock_refunded'), 1));
  });
  it('host cancel without the matching seat release is denied', async () => {
    await setCount(3);
    await seedBooking('b1', { qty: 2, totalInr: 1000 });
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), cf('host', 'none')));
    await assertFails(cancelWithRelease(host(), 'b1', cf('host', 'none'), 2));
  });
  it('multi-seat tickets release qty x seatsPerTicket seats', async () => {
    await setCount(8);
    await seedBooking('b1', { qty: 2, seatsPerTicket: 3, totalInr: 1000 });
    await assertFails(cancelWithRelease(host(), 'b1', cf('host', 'none'), 6));
    await assertSucceeds(cancelWithRelease(host(), 'b1', cf('host', 'none'), 2));
  });
  it('host can also lower the tier counter in the same batch', async () => {
    await setCount(1);
    await seedBooking('b1');
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(countDoc(c.firestore() as never), { booked: 1, updatedAt: Timestamp.now() }); });
    const db = host();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/b1'), cf('host', 'none'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(0, 'b1'));
    b.set(countDoc(db), { booked: 0, updatedAt: serverTimestamp() });
    await assertSucceeds(b.commit());
  });
  it('cannot release twice, un-cancel, cancel twice, or cancel a checked_in booking normally', async () => {
    await setCount(2);
    await seedBooking('b1');
    await assertSucceeds(cancelWithRelease(host(), 'b1', cf('host', 'none'), 1));
    await assertFails(cancelWithRelease(host(), 'b1', cf('host', 'none'), 0));
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { status: 'paid_mock' }));
    await seedBooking('b2', { status: 'checked_in', paidAt: Timestamp.now(), checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' });
    await assertFails(cancelWithRelease(host(), 'b2', cf('host', 'mock_refunded'), 0));
  });
  it('host can cancel a checked_in booking only when its event is cancelled', async () => {
    await setCount(2);
    await seedBooking('b1', { status: 'checked_in', paidAt: Timestamp.now(), checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' });
    // Cannot cancel checked_in normally
    await assertFails(cancelWithRelease(host(), 'b1', cf('host', 'mock_refunded'), 1));
    // Cancel the event first
    await updateDoc(doc(host(), 'bookingEvents/' + BEID), {
      salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com', updatedAt: serverTimestamp(),
    });
    // Now can cancel the checked_in booking with matching seat release
    await assertSucceeds(cancelWithRelease(host(), 'b1', cf('host', 'mock_refunded'), 1));
  });
  it('a reserved booking cancel must have refund none', async () => {
    await setCount(1);
    await seedBooking('b1', { status: 'reserved' });
    await assertFails(cancelWithRelease(host(), 'b1', cf('host', 'mock_refunded'), 0));
    await assertSucceeds(cancelWithRelease(host(), 'b1', cf('host', 'none'), 0));
  });
  it('a cancel cannot edit price/tier/qty/uid, and the reason is length-limited', async () => {
    await setCount(1);
    await seedBooking('b1');
    for (const extra of [{ totalInr: 0 }, { unitPriceInr: 1 }, { tierId: 't2' }, { qty: 5 }, { buyerUid: 'g2' }, { cancelReason: 'x'.repeat(201) }]) {
      await assertFails(cancelWithRelease(host(), 'b1', cf('host', 'none', extra), 0));
    }
  });
  it('a release naming a booking of another event is denied', async () => {
    await setCount(5);
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/be2'), bookingEventDoc({ id: 'be2', bookedCount: 1 })); });
    await seedBooking('b1', { bookingEventId: 'be2' });
    const db = host();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/b1'), cf('host', 'none'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(4, 'b1'));
    await assertFails(b.commit());
  });
});

/* ---------- R54-R56: who may refund, partial release, the refund cutoff ---------- */
describe('refund access and cutoff (R54, R55, R56)', () => {
  const MIN = 60_000;
  const cancelFields = (by: string, refund: 'mock_refunded' | 'none') => ({
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: by, refund,
  });
  const setEvent = (over: Record<string, unknown>) =>
    env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc(over)); });
  const paid = (id: string, over: Record<string, unknown> = {}) =>
    seedBooking(id, { status: 'paid_mock', paidAt: Timestamp.now(), ...over });
  async function cancelAs(db: ReturnType<typeof guest>, email: string, id: string, refund: 'mock_refunded' | 'none', newCount: number) {
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/' + id), cancelFields(email, refund));
    b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: newCount, lastReleaseBookingId: id, updatedAt: serverTimestamp() });
    return b.commit();
  }
  /** Partial release as the client transaction writes it: booking, event counter and tier counter together. */
  async function partial(db: ReturnType<typeof guest>, id: string, p: {
    qty: number; totalInr: number; discountAmountInr: number; refund: 'mock_refunded' | 'none'; refundedInr?: number;
    evCount: number; tierBooked: number;
  }) {
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/' + id), {
      qty: p.qty, totalInr: p.totalInr, discountAmountInr: p.discountAmountInr, refund: p.refund,
      ...(p.refundedInr === undefined ? {} : { refundedInr: p.refundedInr }),
    });
    b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: p.evCount, lastReleaseBookingId: id, updatedAt: serverTimestamp() });
    b.set(countDoc(db), { booked: p.tierBooked, updatedAt: serverTimestamp() });
    return b.commit();
  }
  const seedCounts = (bookedCount: number, tierBooked: number, evOver: Record<string, unknown> = {}) =>
    env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount, ...evOver }));
      await setDoc(countDoc(c.firestore() as never), { booked: tierBooked, updatedAt: Timestamp.now() });
    });

  describe('who may cancel (R54)', () => {
    it('a venue_host is REFUSED a cancel (reserved and paid)', async () => {
      await seedCounts(2, 2);
      await seedBooking('r1');
      await paid('p1');
      await assertFails(cancelAs(venueRole(), 'venue@x.com', 'r1', 'none', 1));
      await assertFails(cancelAs(venueRole(), 'venue@x.com', 'p1', 'mock_refunded', 1));
    });
    it('a venue_host can still check in and assign cards (not a refund)', async () => {
      await paid('p1');
      await assertSucceeds(updateDoc(doc(venueRole(), 'bookings/p1'), {
        status: 'checked_in', checkedInAt: serverTimestamp(), checkedInBy: 'venue@x.com',
      }));
    });
    it('a host (users role) IS allowed a full paid cancel', async () => {
      await seedCounts(1, 1);
      await paid('p1');
      await assertSucceeds(cancelAs(hostRole(), 'hostrole@x.com', 'p1', 'mock_refunded', 0));
    });
    it('an admin IS allowed a full cancel; marketing is refused', async () => {
      await seedCounts(2, 2);
      await paid('p1');
      await paid('p2');
      await assertFails(cancelAs(marketer(), 'mkt@x.com', 'p1', 'mock_refunded', 1));
      await assertSucceeds(cancelAs(adminRole(), 'admin@x.com', 'p1', 'mock_refunded', 1));
    });
  });

  describe('counters cannot be unwound by hand (R54 bypass)', () => {
    const lowerEvent = (db: ReturnType<typeof guest>, extra: Record<string, unknown> = {}) =>
      updateDoc(doc(db, 'bookingEvents/' + BEID), { bookedCount: 2, updatedAt: serverTimestamp(), ...extra });
    const lowerTier = (db: ReturnType<typeof guest>, booked = 2) =>
      setDoc(countDoc(db), { booked, updatedAt: serverTimestamp() });
    /** Full cancel as the client writes it: booking, event counter AND tier counter in one batch. */
    async function cancelWithTier(db: ReturnType<typeof guest>, email: string, id: string, evCount: number, tierBooked: number) {
      const b = writeBatch(db);
      b.update(doc(db, 'bookings/' + id), cancelFields(email, 'mock_refunded'));
      b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: evCount, lastReleaseBookingId: id, updatedAt: serverTimestamp() });
      b.set(countDoc(db), { booked: tierBooked, updatedAt: serverTimestamp() });
      return b.commit();
    }
    beforeEach(async () => {
      await seedCounts(3, 3);
      await paid('p1');
    });

    it('nobody lowers bookedCount through the plain event edit, whatever their role', async () => {
      for (const db of [venueRole(), marketer(), guest(), other(), hostRole(), adminRole(), host()]) {
        await assertFails(lowerEvent(db));
      }
    });
    it('naming a booking in lastReleaseBookingId does not rescue a lowering with no cancel', async () => {
      for (const db of [venueRole(), hostRole(), adminRole(), host()]) {
        await assertFails(lowerEvent(db, { lastReleaseBookingId: 'p1' }));
      }
    });
    it('a whole-document write that lowers bookedCount is refused too', async () => {
      await assertFails(setDoc(doc(venueRole(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 0 })));
      await assertFails(setDoc(doc(hostRole(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 0 })));
    });
    it('bookedCount cannot be RAISED by the plain edit either (no sell-out griefing by staff)', async () => {
      await assertFails(lowerEvent(venueRole(), { bookedCount: 10 }));
      await assertFails(lowerEvent(host(), { bookedCount: 10 }));
    });
    it('a venue_host can still edit ordinary fields: title, tiers, salesOpen', async () => {
      const v = venueRole();
      const ref = doc(v, 'bookingEvents/' + BEID);
      await assertSucceeds(updateDoc(ref, { title: 'Renamed', updatedAt: serverTimestamp() }));
      await assertSucceeds(updateDoc(ref, {
        tiers: [{ id: 't1', label: 'Single', priceInr: 600 }, { id: 't2', label: 'Duo', priceInr: 900 }], updatedAt: serverTimestamp(),
      }));
      await assertSucceeds(updateDoc(ref, { salesOpen: false, updatedAt: serverTimestamp() }));
      // the host form saving the whole document back with the SAME bookedCount is fine
      const cur = (await getDoc(ref)).data() as Record<string, unknown>;
      await assertSucceeds(setDoc(ref, { ...cur, description: 'Evening race', updatedAt: serverTimestamp() }));
    });
    it('a host and an admin can edit ordinary fields too', async () => {
      await assertSucceeds(updateDoc(doc(hostRole(), 'bookingEvents/' + BEID), { title: 'By host', updatedAt: serverTimestamp() }));
      await assertSucceeds(updateDoc(doc(adminRole(), 'bookingEvents/' + BEID), { title: 'By admin', updatedAt: serverTimestamp() }));
    });
    it('the legitimate cancel batch (booking + event + tier counter) still succeeds for host and admin', async () => {
      await assertSucceeds(cancelWithTier(hostRole(), 'hostrole@x.com', 'p1', 2, 2));
      await paid('p2');
      await assertSucceeds(cancelWithTier(adminRole(), 'admin@x.com', 'p2', 1, 1));
    });
    it('a venue_host or marketing cancel batch is refused', async () => {
      await assertFails(cancelWithTier(venueRole(), 'venue@x.com', 'p1', 2, 2));
      await assertFails(cancelWithTier(marketer(), 'mkt@x.com', 'p1', 2, 2));
    });
    it('a lone event-counter decrease never rides on a booking that was not cancelled', async () => {
      const db = hostRole();
      const b = writeBatch(db);
      b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: 2, lastReleaseBookingId: 'p1', updatedAt: serverTimestamp() });
      await assertFails(b.commit());
    });

    describe('tier counters', () => {
      it('no role lowers a tier counter on its own, super admin included', async () => {
        for (const db of [venueRole(), marketer(), guest(), hostRole(), adminRole(), host()]) {
          await assertFails(lowerTier(db));
        }
      });
      it('nobody raises one on staff authority either', async () => {
        for (const db of [venueRole(), hostRole(), adminRole(), host()]) await assertFails(lowerTier(db, 9));
      });
      it('a staff decrease cannot ride on a plain event edit that merely names a booking', async () => {
        const db = hostRole();
        const b = writeBatch(db);
        b.update(doc(db, 'bookingEvents/' + BEID), { lastReleaseBookingId: 'p1', updatedAt: serverTimestamp() });
        b.set(countDoc(db), { booked: 2, updatedAt: serverTimestamp() });
        await assertFails(b.commit());
      });
      it('a cancel must lower the tier counter by exactly the booking qty', async () => {
        await assertFails(cancelWithTier(hostRole(), 'hostrole@x.com', 'p1', 2, 0));
        await assertFails(cancelWithTier(hostRole(), 'hostrole@x.com', 'p1', 2, 3));
        await assertSucceeds(cancelWithTier(hostRole(), 'hostrole@x.com', 'p1', 2, 2));
      });
      it('the counter floors at zero like the client (a stale counter below qty)', async () => {
        await seedCounts(3, 0);
        await assertFails(cancelWithTier(hostRole(), 'hostrole@x.com', 'p1', 2, 1));
        await assertSucceeds(cancelWithTier(hostRole(), 'hostrole@x.com', 'p1', 2, 0));
      });
      it('a cancel cannot lower the counter of a different tier than the booking\'s', async () => {
        const db = hostRole();
        const b = writeBatch(db);
        b.update(doc(db, 'bookings/p1'), cancelFields('hostrole@x.com', 'mock_refunded'));
        b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: 2, lastReleaseBookingId: 'p1', updatedAt: serverTimestamp() });
        b.set(countDoc(db, 't2'), { booked: 2, updatedAt: serverTimestamp() });
        await assertFails(b.commit());
      });
    });
  });

  describe('partial release (R55)', () => {
    // 3 tickets x 500, 3 seats, paid: release 1 -> total ceil(1500*2/3)=1000, refund 500
    const release1 = { qty: 2, totalInr: 1000, discountAmountInr: 0, refund: 'mock_refunded' as const, refundedInr: 500, evCount: 2, tierBooked: 2 };
    const setup = async (over: Record<string, unknown> = {}) => {
      await seedCounts(3, 3);
      await paid('p1', { qty: 3, totalInr: 1500, ...over });
    };
    it('a host is REFUSED a partial release', async () => {
      await setup();
      await assertFails(partial(hostRole(), 'p1', release1));
    });
    it('a venue_host and marketing are refused too', async () => {
      await setup();
      await assertFails(partial(venueRole(), 'p1', release1));
      await assertFails(partial(marketer(), 'p1', release1));
    });
    it('an admin IS allowed one; so is a super admin', async () => {
      await setup();
      await assertSucceeds(partial(adminRole(), 'p1', release1));
      await setup();
      await assertSucceeds(partial(host(), 'p1', release1));
    });
    it('the counters must drop by exactly the released tickets', async () => {
      await setup();
      await assertFails(partial(adminRole(), 'p1', { ...release1, evCount: 1 }));
      await assertFails(partial(adminRole(), 'p1', { ...release1, evCount: 3 }));
      await assertFails(partial(adminRole(), 'p1', { ...release1, tierBooked: 1 }));
      await assertFails(partial(adminRole(), 'p1', { ...release1, tierBooked: 3 }));
    });
    it('multi-seat tickets release releasedTickets x seatsPerTicket seats', async () => {
      await seedCounts(6, 3);
      await paid('p1', { qty: 3, seatsPerTicket: 2, totalInr: 1500 });
      await assertFails(partial(adminRole(), 'p1', { ...release1, evCount: 5 }));
      await assertSucceeds(partial(adminRole(), 'p1', { ...release1, evCount: 4 }));
    });
    it('the refund amount, total and discount must be the pro-rata figures', async () => {
      await setup();
      await assertFails(partial(adminRole(), 'p1', { ...release1, totalInr: 900, discountAmountInr: 100, refundedInr: 600 }));
      await assertFails(partial(adminRole(), 'p1', { ...release1, refundedInr: 600 }));
      await assertFails(partial(adminRole(), 'p1', { ...release1, discountAmountInr: 50 }));
      await assertFails(partial(adminRole(), 'p1', { ...release1, refund: 'none' }));
    });
    it('qty must fall by at least 1 and stay at least 1 (a full release is a cancel)', async () => {
      await setup();
      await assertFails(partial(adminRole(), 'p1', { ...release1, qty: 3, totalInr: 1500, refundedInr: 0, evCount: 3, tierBooked: 3 }));
      await assertFails(partial(adminRole(), 'p1', { ...release1, qty: 4, totalInr: 2000, evCount: 2, tierBooked: 2 }));
      await assertFails(partial(adminRole(), 'p1', { ...release1, qty: 0, totalInr: 0, refundedInr: 1500, evCount: 0, tierBooked: 0 }));
    });
    it('a partial release that would free a checked-in seat is REFUSED', async () => {
      await setup({ checkedInCount: 3 });
      await assertFails(partial(adminRole(), 'p1', release1));
    });
    it('releasing only the seats nobody has used is allowed', async () => {
      await setup({ checkedInCount: 2 });
      await assertSucceeds(partial(adminRole(), 'p1', release1));
    });
    it('an unpaid reservation releases with refund none and no refundedInr', async () => {
      await seedCounts(3, 3);
      await seedBooking('r1', { qty: 3, totalInr: 1500 });
      await assertFails(partial(adminRole(), 'r1', release1));
      await assertSucceeds(partial(adminRole(), 'r1', { ...release1, refund: 'none', refundedInr: undefined }));
    });
    it('refundedInr accumulates across releases', async () => {
      await seedCounts(2, 2);
      await paid('p1', { qty: 2, totalInr: 1000, refundedInr: 500, refund: 'mock_refunded' });
      await assertFails(partial(adminRole(), 'p1', { qty: 1, totalInr: 500, discountAmountInr: 0, refund: 'mock_refunded', refundedInr: 500, evCount: 1, tierBooked: 1 }));
      await assertSucceeds(partial(adminRole(), 'p1', { qty: 1, totalInr: 500, discountAmountInr: 0, refund: 'mock_refunded', refundedInr: 1000, evCount: 1, tierBooked: 1 }));
    });
    it('the cutoff applies: a paid partial release inside the window is refused, outside allowed', async () => {
      await seedCounts(3, 3, { dateMs: Date.now() + 30 * MIN });
      await paid('p1', { qty: 3, totalInr: 1500 });
      await assertFails(partial(adminRole(), 'p1', release1));
      await seedCounts(3, 3, { dateMs: Date.now() + 120 * MIN });
      await assertSucceeds(partial(adminRole(), 'p1', release1));
    });
    it('the booking edit alone, without the event counters, is refused', async () => {
      await setup();
      await assertFails(updateDoc(doc(adminRole(), 'bookings/p1'), { qty: 2, totalInr: 1000, discountAmountInr: 0, refund: 'mock_refunded', refundedInr: 500 }));
    });
    it('a partial edit cannot also change other fields', async () => {
      await setup();
      const db = adminRole();
      const b = writeBatch(db);
      b.update(doc(db, 'bookings/p1'), { qty: 2, totalInr: 1000, discountAmountInr: 0, refund: 'mock_refunded', refundedInr: 500, tierId: 't2' });
      b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: 2, lastReleaseBookingId: 'p1', updatedAt: serverTimestamp() });
      await assertFails(b.commit());
    });
  });

  describe('refund cutoff (R56)', () => {
    it('a paid cancel inside the cutoff is REFUSED (default 60 minutes)', async () => {
      await seedCounts(1, 1, { dateMs: Date.now() + 30 * MIN });
      await paid('p1');
      await assertFails(cancelAs(hostRole(), 'hostrole@x.com', 'p1', 'mock_refunded', 0));
      await assertFails(cancelAs(adminRole(), 'admin@x.com', 'p1', 'mock_refunded', 0));
    });
    it('the same paid cancel is allowed just outside the cutoff', async () => {
      await seedCounts(1, 1, { dateMs: Date.now() + 90 * MIN });
      await paid('p1');
      await assertSucceeds(cancelAs(hostRole(), 'hostrole@x.com', 'p1', 'mock_refunded', 0));
    });
    it('a custom refundCutoffMin is honoured, and 0 allows refunds until the start', async () => {
      await seedCounts(1, 1, { dateMs: Date.now() + 90 * MIN, refundCutoffMin: 180 });
      await paid('p1');
      await assertFails(cancelAs(hostRole(), 'hostrole@x.com', 'p1', 'mock_refunded', 0));
      await seedCounts(1, 1, { dateMs: Date.now() + 5 * MIN, refundCutoffMin: 0 });
      await assertSucceeds(cancelAs(hostRole(), 'hostrole@x.com', 'p1', 'mock_refunded', 0));
    });
    it('an event that already started refuses a paid refund', async () => {
      await seedCounts(1, 1, { dateMs: Date.now() - 10 * MIN, refundCutoffMin: 0 });
      await paid('p1');
      await assertFails(cancelAs(hostRole(), 'hostrole@x.com', 'p1', 'mock_refunded', 0));
    });
    it('the same cancel on a CANCELLED event is ALLOWED, whatever the timing', async () => {
      await seedCounts(1, 1, {
        dateMs: Date.now() + 5 * MIN, cancelled: true, salesOpen: false, cancelledAt: Timestamp.now(), cancelledBy: 'host@x.com',
      });
      await paid('p1');
      await assertSucceeds(cancelAs(hostRole(), 'hostrole@x.com', 'p1', 'mock_refunded', 0));
    });
    it('an unpaid reserved cancel inside the cutoff is ALLOWED (no refund to give)', async () => {
      await seedCounts(1, 1, { dateMs: Date.now() + 5 * MIN });
      await seedBooking('r1');
      await assertSucceeds(cancelAs(hostRole(), 'hostrole@x.com', 'r1', 'none', 0));
    });
    it('an event without dateMs (legacy) refuses a paid refund but not an unpaid cancel', async () => {
      await env.withSecurityRulesDisabled(async (c) => {
        const { dateMs: _drop, ...legacy } = bookingEventDoc({ bookedCount: 2 });
        void _drop;
        await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), legacy);
      });
      await paid('p1');
      await seedBooking('r1');
      await assertFails(cancelAs(hostRole(), 'hostrole@x.com', 'p1', 'mock_refunded', 1));
      await assertSucceeds(cancelAs(hostRole(), 'hostrole@x.com', 'r1', 'none', 1));
    });
  });

  describe('editing the cutoff (R56)', () => {
    const edit = (db: ReturnType<typeof guest>, over: Record<string, unknown>) =>
      setDoc(doc(db, 'bookingEvents/' + BEID), bookingEventDoc(over));
    it('a non-admin is REFUSED a refundCutoffMin edit (host, venue_host)', async () => {
      await assertFails(edit(hostRole(), { refundCutoffMin: 5 }));
      await assertFails(edit(venueRole(), { refundCutoffMin: 5 }));
      await assertFails(updateDoc(doc(hostRole(), 'bookingEvents/' + BEID), { refundCutoffMin: 0, updatedAt: serverTimestamp() }));
    });
    it('a host cannot remove an existing cutoff either', async () => {
      await setEvent({ refundCutoffMin: 120 });
      await assertFails(edit(hostRole(), {}));
      await assertSucceeds(edit(hostRole(), { refundCutoffMin: 120, title: 'Renamed' }));
    });
    it('a host can still edit the rest of the event', async () => {
      await assertSucceeds(edit(hostRole(), { capacity: 20 }));
      await assertSucceeds(edit(venueRole(), { capacity: 25 }));
    });
    it('an admin and a super admin may set it, within 0..10080 integers only', async () => {
      await assertSucceeds(edit(adminRole(), { refundCutoffMin: 0 }));
      await assertSucceeds(edit(adminRole(), { refundCutoffMin: 10080 }));
      await assertSucceeds(edit(host(), { refundCutoffMin: 240 }));
      for (const bad of [-1, 10081, 1.5, '60', null]) await assertFails(edit(adminRole(), { refundCutoffMin: bad }));
    });
    it('dateMs must be a positive integer', async () => {
      await assertSucceeds(edit(hostRole(), { dateMs: Date.now() }));
      for (const bad of [0, -5, 1.5, '1']) await assertFails(edit(hostRole(), { dateMs: bad }));
    });
  });
});

describe('A1: event cancellation unlocks refunds only when a refunder did it', () => {
  const cancelEv = (db: ReturnType<typeof guest>, by: string) => updateDoc(doc(db, 'bookingEvents/' + BEID), {
    salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: by, updatedAt: serverTimestamp(),
  });
  it('a venue_host or marketing cannot cancel an event (it would open refunds inside the cutoff)', async () => {
    await assertFails(cancelEv(venueRole(), 'venue@x.com'));
    await assertFails(cancelEv(marketer(), 'mkt@x.com'));
  });
  it('a host and an admin can, stamped with their own email only', async () => {
    await assertFails(cancelEv(hostRole(), 'someone@x.com'));
    await assertSucceeds(cancelEv(hostRole(), 'hostrole@x.com'));
    await seed();
    await assertSucceeds(cancelEv(adminRole(), 'admin@x.com'));
  });
  it('an event can never be created already cancelled', async () => {
    await assertFails(setDoc(doc(host(), 'bookingEvents/be3'), bookingEventDoc({
      id: 'be3', salesOpen: false, cancelled: true, cancelledAt: serverTimestamp(), cancelledBy: 'host@x.com',
    })));
  });
});

describe('A1: the guest who booked can never cancel, refund or reduce it', () => {
  it('owner cannot set status cancelled (reserved or paid), with or without a refund label', async () => {
    await seedBooking('r1');
    await seedBooking('p1', { status: 'paid_mock', paidAt: Timestamp.now() });
    for (const id of ['r1', 'p1']) {
      await assertFails(updateDoc(doc(guest(), 'bookings/' + id), { status: 'cancelled' }));
      await assertFails(updateDoc(doc(guest(), 'bookings/' + id),
        { status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: 'guest1@example.com', refund: 'mock_refunded' }));
    }
  });
  it('owner cannot reduce qty or total', async () => {
    await seedBooking('p1', { status: 'paid_mock', paidAt: Timestamp.now(), qty: 2, totalInr: 1000 });
    await assertFails(updateDoc(doc(guest(), 'bookings/p1'), { qty: 1 }));
    await assertFails(updateDoc(doc(guest(), 'bookings/p1'), { qty: 1, totalInr: 500, refund: 'mock_refunded', refundedInr: 500 }));
  });
  it('owner cannot delete', async () => {
    await seedBooking('p1', { status: 'paid_mock', paidAt: Timestamp.now() });
    await assertFails(deleteDoc(doc(guest(), 'bookings/p1')));
  });
});

describe('A2: qrToken issued once by the owner', () => {
  const TOK = 'Ab3dEf6hIj9kLm2nOp5qRs8tUv1wXy4z';
  const noToken = async (id: string, over: Record<string, unknown> = {}) => {
    await env.withSecurityRulesDisabled(async (c) => {
      const { qrToken: _q, ...rest } = booking(id, { status: 'paid_mock', paidAt: Timestamp.now(), ...over });
      void _q;
      await setDoc(doc(c.firestore(), 'bookings/' + id), rest);
    });
  };
  it('the owner adds a 32-char base62 token to a ticket without one', async () => {
    await noToken('b1');
    await assertSucceeds(updateDoc(doc(guest(), 'bookings/b1'), { qrToken: TOK }));
  });
  it('wrong shape, extra fields, another person or staff are refused', async () => {
    await noToken('b1');
    for (const bad of ['short', TOK + 'x', TOK.slice(0, 31) + '-', 42]) {
      await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { qrToken: bad }));
    }
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { qrToken: TOK, status: 'checked_in' }));
    await assertFails(updateDoc(doc(other(), 'bookings/b1'), { qrToken: TOK }));
    await assertFails(updateDoc(doc(hostRole(), 'bookings/b1'), { qrToken: TOK }));
  });
  it('once set it can never be changed or removed, not even by the owner', async () => {
    await seedBooking('b2');
    await assertFails(updateDoc(doc(guest(), 'bookings/b2'), { qrToken: TOK }));
    await noToken('b3');
    await updateDoc(doc(guest(), 'bookings/b3'), { qrToken: TOK });
    await assertFails(updateDoc(doc(guest(), 'bookings/b3'), { qrToken: TOK.toLowerCase() }));
    const { deleteField } = await import('firebase/firestore');
    await assertFails(updateDoc(doc(guest(), 'bookings/b3'), { qrToken: deleteField() }));
  });
});

describe('A3: check-in method is recorded', () => {
  it('scan and manual are accepted with the staff email', async () => {
    await seedBooking('b1', { status: 'paid_mock' });
    await assertSucceeds(updateDoc(doc(hostRole(), 'bookings/b1'),
      { status: 'checked_in', checkedInAt: serverTimestamp(), checkedInBy: 'hostrole@x.com', checkedInCount: 1, checkInMethod: 'manual' }));
    await seedBooking('b2', { status: 'paid_mock' });
    await assertSucceeds(updateDoc(doc(venueRole(), 'bookings/b2'),
      { status: 'checked_in', checkedInAt: serverTimestamp(), checkedInBy: 'venue@x.com', checkInMethod: 'scan' }));
  });
  it('any other method value is refused, and a guest cannot set it', async () => {
    await seedBooking('b1', { status: 'paid_mock' });
    await assertFails(updateDoc(doc(hostRole(), 'bookings/b1'),
      { status: 'checked_in', checkedInAt: serverTimestamp(), checkedInBy: 'hostrole@x.com', checkInMethod: 'typed' }));
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { checkInMethod: 'scan' }));
  });
});
