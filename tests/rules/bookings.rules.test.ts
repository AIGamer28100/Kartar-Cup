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
  tierId: 't1', qty: 1, unitPriceInr: 500, discountAmountInr: 0, totalInr: 500, status: 'reserved',
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

describe('reservation create', () => {
  it('owner creates own reservation', async () => {
    await assertSucceeds(setDoc(doc(guest(), 'bookings/b1'), booking('b1')));
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
    await assertSucceeds(setDoc(doc(guest(), 'bookings/b1'),
      booking('b1', { qty: 10, unitPriceInr: 500, totalInr: 5000 })));
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

describe('cancelBooking', () => {
  const cancelFields = (by: 'guest' | 'host', refund: 'mock_refunded' | 'none', extra: Record<string, unknown> = {}) => ({
    status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: by, refund, ...extra,
  });
  /** Cancel + seat release in one atomic batch, as the client transaction does. */
  async function cancelWithRelease(db: ReturnType<typeof guest>, id: string, fields: Record<string, unknown>, newCount: number) {
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/' + id), fields);
    b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: newCount, lastReleaseBookingId: id, updatedAt: serverTimestamp() });
    return b.commit();
  }

  it('owner cancels a reserved booking and releases its seats', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 3 })); });
    await seedBooking('b1', { qty: 2, totalInr: 1000, unitPriceInr: 500 });
    await assertSucceeds(cancelWithRelease(guest(), 'b1', cancelFields('guest', 'none'), 1));
  });
  it('owner cancels a paid_mock booking with mock_refunded', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 1 })); });
    await seedBooking('b1', { status: 'paid_mock', paidAt: Timestamp.now() });
    await assertSucceeds(cancelWithRelease(guest(), 'b1', cancelFields('guest', 'mock_refunded', { cancelReason: 'Plans changed' }), 0));
  });
  it('refund label must match the prior status', async () => {
    await seedBooking('b1', { status: 'paid_mock', paidAt: Timestamp.now() });
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), cancelFields('guest', 'none')));
  });
  it('owner cancel without releasing the matching seats is denied', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 3 })); });
    await seedBooking('b1', { qty: 2, totalInr: 1000, unitPriceInr: 500 });
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), cancelFields('guest', 'none')));
    await assertFails(cancelWithRelease(guest(), 'b1', cancelFields('guest', 'none'), 2));
  });
  it('cannot cancel someone else\'s booking', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 1 })); });
    await seedBooking('b1');
    await assertFails(cancelWithRelease(other(), 'b1', cancelFields('guest', 'none'), 0));
  });
  it('owner cannot claim cancelledBy host', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 1 })); });
    await seedBooking('b1');
    await assertFails(cancelWithRelease(guest(), 'b1', cancelFields('host', 'none'), 0));
  });
  it('owner cannot edit price/tier/qty/uid alongside a cancel', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 1 })); });
    await seedBooking('b1');
    for (const extra of [{ totalInr: 0 }, { unitPriceInr: 1 }, { tierId: 't2' }, { qty: 5 }, { buyerUid: 'g2' }]) {
      await assertFails(cancelWithRelease(guest(), 'b1', cancelFields('guest', 'none', extra), 0));
    }
  });
  it('owner cannot change fields without cancelling', async () => {
    await seedBooking('b1');
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { totalInr: 0 }));
  });
  it('cannot un-cancel (owner or host)', async () => {
    await seedBooking('b1', { status: 'cancelled', cancelledBy: 'guest', refund: 'none', cancelledAt: Timestamp.now() });
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { status: 'reserved' }));
    await assertFails(updateDoc(doc(guest(), 'bookings/b1'), { status: 'paid_mock', paidAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), { status: 'paid_mock' }));
  });
  it('cannot cancel twice', async () => {
    await seedBooking('b1', { status: 'cancelled', cancelledBy: 'guest', refund: 'none', cancelledAt: Timestamp.now() });
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), cancelFields('host', 'none')));
  });
  it('cannot cancel a checked_in booking (owner or host)', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 1 })); });
    await seedBooking('b1', { status: 'checked_in', paidAt: Timestamp.now(), checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' });
    await assertFails(cancelWithRelease(guest(), 'b1', cancelFields('guest', 'mock_refunded'), 0));
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), cancelFields('host', 'mock_refunded')));
  });
  it('host cancels any non-checked-in booking', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 2 })); });
    await seedBooking('b1');
    await seedBooking('b2', { status: 'paid_mock', paidAt: Timestamp.now() });
    await assertSucceeds(cancelWithRelease(host(), 'b1', cancelFields('host', 'none', { cancelReason: 'Venue closed' }), 1));
    await assertSucceeds(cancelWithRelease(host(), 'b2', cancelFields('host', 'mock_refunded'), 0));
  });
  it('a guest cannot cancel with an over-long reason', async () => {
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 1 })); });
    await seedBooking('b1');
    await assertFails(cancelWithRelease(guest(), 'b1', cancelFields('guest', 'none', { cancelReason: 'x'.repeat(201) }), 0));
  });
});

describe('seat release on the event (capacityRelease)', () => {
  const setCount = (n: number, over: Record<string, unknown> = {}) =>
    env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: n, ...over })); });
  const cf = (by: 'guest' | 'host', refund = 'none') => ({ status: 'cancelled', cancelledAt: serverTimestamp(), cancelledBy: by, refund });
  const evUpd = (n: number, bid: unknown, extra: Record<string, unknown> = {}) =>
    ({ bookedCount: n, lastReleaseBookingId: bid, updatedAt: serverTimestamp(), ...extra });

  it('(a) a user with no booking cannot lower the counter at all', async () => {
    await setCount(5);
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), { bookedCount: 4, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(4, 'nope')));
  });
  it('(a) cannot release using someone else\'s booking, even cancelled in the same batch by a host-less guest', async () => {
    await setCount(5);
    await seedBooking('b1'); // owned by g1
    const db = other();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/b1'), cf('guest'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(4, 'b1'));
    await assertFails(b.commit());
    // event write alone naming a live booking: booking is not cancelled after the write
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(4, 'b1')));
  });
  it('(a) cannot release by naming an already-cancelled booking', async () => {
    await setCount(5);
    await seedBooking('b1', { status: 'cancelled', cancelledBy: 'guest', refund: 'none', cancelledAt: Timestamp.now() });
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(4, 'b1')));
  });
  it('(b) decrease must equal the booking qty exactly (too small or too large)', async () => {
    await setCount(6);
    await seedBooking('b1', { qty: 3, totalInr: 1500 });
    for (const n of [5, 4, 2, 0]) {
      const db = guest();
      const b = writeBatch(db);
      b.update(doc(db, 'bookings/b1'), cf('guest'));
      b.update(doc(db, 'bookingEvents/' + BEID), evUpd(n, 'b1'));
      await assertFails(b.commit());
    }
    const db = guest();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/b1'), cf('guest'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(3, 'b1'));
    await assertSucceeds(b.commit());
  });
  it('(c) cannot release twice for one booking', async () => {
    await setCount(5);
    await seedBooking('b1');
    const db = guest();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/b1'), cf('guest'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(4, 'b1'));
    await assertSucceeds(b.commit());
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(3, 'b1')));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(3, 'b1x')));
    // re-cancel with a fresh release is also denied (booking already cancelled)
    const b2 = writeBatch(db);
    b2.update(doc(db, 'bookings/b1'), cf('guest'));
    b2.update(doc(db, 'bookingEvents/' + BEID), evUpd(3, 'b1'));
    await assertFails(b2.commit());
  });
  it('(c) two decrements of one booking inside a single batch are denied', async () => {
    await setCount(5);
    await seedBooking('b1');
    const db = guest();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/b1'), cf('guest'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(4, 'b1'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(3, 'b1'));
    await assertFails(b.commit());
  });
  it('(c) a release naming a booking of another event is denied', async () => {
    await setCount(5);
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'bookingEvents/be2'), bookingEventDoc({ id: 'be2', bookedCount: 1 })); });
    await seedBooking('b1', { bookingEventId: 'be2' });
    const db = guest();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/b1'), cf('guest'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(4, 'b1'));
    await assertFails(b.commit());
  });
  it('(d) counter never goes below 0, never rises via release, no other fields', async () => {
    await setCount(1);
    await seedBooking('b1', { qty: 2, totalInr: 1000 });
    const db = guest();
    const b = writeBatch(db);
    b.update(doc(db, 'bookings/b1'), cf('guest'));
    b.update(doc(db, 'bookingEvents/' + BEID), evUpd(-1, 'b1'));
    await assertFails(b.commit());
    await setCount(2);
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), { bookedCount: -1, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(2, 'b1', { capacity: 99 })));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(1, 'b1', { capacity: 99 })));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(3, 'b1')));
  });
  it('(d) the bump path cannot exceed capacity or smuggle lastReleaseBookingId', async () => {
    await setCount(9);
    await assertSucceeds(updateDoc(doc(guest(), 'bookingEvents/' + BEID), { bookedCount: 10, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), { bookedCount: 11, updatedAt: serverTimestamp() }));
    await setCount(5);
    await assertFails(updateDoc(doc(guest(), 'bookingEvents/' + BEID), evUpd(6, 'b1')));
  });
  it('(e) host cancels any booking only with the matching decrease', async () => {
    await setCount(4);
    await seedBooking('b1', { qty: 2, totalInr: 1000 });
    await seedBooking('b2', { status: 'paid_mock', paidAt: Timestamp.now() });
    // bare host cancel (no release) and wrong-size release are denied
    await assertFails(updateDoc(doc(host(), 'bookings/b1'), cf('host')));
    const h = host();
    const bad = writeBatch(h);
    bad.update(doc(h, 'bookings/b1'), cf('host'));
    bad.update(doc(h, 'bookingEvents/' + BEID), evUpd(3, 'b1'));
    await assertFails(bad.commit());
    const ok = writeBatch(h);
    ok.update(doc(h, 'bookings/b1'), cf('host'));
    ok.update(doc(h, 'bookingEvents/' + BEID), evUpd(2, 'b1'));
    await assertSucceeds(ok.commit());
    const ok2 = writeBatch(h);
    ok2.update(doc(h, 'bookings/b2'), cf('host', 'mock_refunded'));
    ok2.update(doc(h, 'bookingEvents/' + BEID), evUpd(1, 'b2'));
    await assertSucceeds(ok2.commit());
  });
  it('(f) reservation transaction still passes, and the counter cannot be pushed past capacity', async () => {
    await setCount(9);
    const db = guest();
    const b = writeBatch(db);
    b.update(doc(db, 'bookingEvents/' + BEID), { bookedCount: 10, updatedAt: serverTimestamp() });
    b.set(doc(db, 'bookings/n1'), booking('n1'));
    await assertSucceeds(b.commit());
    const db2 = other();
    const b2 = writeBatch(db2);
    b2.update(doc(db2, 'bookingEvents/' + BEID), { bookedCount: 11, updatedAt: serverTimestamp() });
    b2.set(doc(db2, 'bookings/n2'), booking('n2', { buyerUid: 'g2', buyerEmail: 'guest2@example.com' }));
    await assertFails(b2.commit());
  });
  it('a host may still edit an event that carries lastReleaseBookingId', async () => {
    await setCount(2, { lastReleaseBookingId: 'old' });
    await assertSucceeds(setDoc(doc(host(), 'bookingEvents/' + BEID), bookingEventDoc({ bookedCount: 2, lastReleaseBookingId: 'old', title: 'Renamed' })));
  });
});
