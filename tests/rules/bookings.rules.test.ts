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
const host = () => env.authenticatedContext('h1', HOST_TOKEN).firestore();

const BEID = 'be1';
const venue = { id: 'v1', name: 'Venue', city: 'Chennai' };
const tiers = [{ id: 't1', label: 'Single', priceInr: 500 }, { id: 't2', label: 'Duo', priceInr: 900 }];

const bookingEventDoc = (over: Record<string, unknown> = {}) => ({
  id: BEID, raceId: 'custom', title: 'Watch Party', venue, dateUtc: '2026-10-01T00:00:00Z',
  tiers, discounts: [], capacity: 10, bookedCount: 0, salesOpen: true,
  createdAt: Timestamp.now(), updatedAt: Timestamp.now(), ...over,
});

async function seed(over: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'bookingEvents/' + BEID), bookingEventDoc(over));
    await setDoc(doc(db, 'hosts/host@x.com'), { role: 'host' });
  });
}

const booking = (id: string, over: Record<string, unknown> = {}) => ({
  id, bookingEventId: BEID, buyerUid: 'g1', buyerName: 'Guest One', buyerEmail: 'guest1@example.com',
  tierId: 't1', tierIndex: 0, qty: 1, seatsPerTicket: 1, unitPriceInr: 500, discountAmountInr: 0, totalInr: 500, status: 'reserved',
  qrToken: id, createdAt: serverTimestamp(), ...over,
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
  b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: ev.bookedCount + (opts.bump ?? qty * seats), updatedAt: serverTimestamp() });
  if (!opts.skipTier) b.set(countDoc(db, tierId), { booked: sold + (opts.tierBump ?? qty), updatedAt: serverTimestamp() });
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
    await assertSucceeds(setDoc(countDoc(host()), { booked: 0, updatedAt: serverTimestamp() }));
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
    await assertFails(setDoc(doc(guest(), 'bookings/b1'), booking('other', { qrToken: 'other' })));
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

describe('cancelBooking (host / host-control members only)', () => {
  const cf = (by: 'guest' | 'host', refund: 'mock_refunded' | 'none', extra: Record<string, unknown> = {}) => ({
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: by, refund, ...extra,
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
  it('cannot release twice, un-cancel, cancel twice, or cancel a checked_in booking', async () => {
    await setCount(2);
    await seedBooking('b1');
    await assertSucceeds(cancelWithRelease(host(), 'b1', cf('host', 'none'), 1));
    await assertFails(cancelWithRelease(host(), 'b1', cf('host', 'none'), 0));
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { status: 'paid_mock' }));
    await seedBooking('b2', { status: 'checked_in', paidAt: Timestamp.now(), checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' });
    await assertFails(cancelWithRelease(host(), 'b2', cf('host', 'mock_refunded'), 0));
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
