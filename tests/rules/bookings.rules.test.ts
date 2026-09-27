import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, where, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';

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
  qrToken: id, createdAt: Timestamp.now(), ...over,
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
    await assertSucceeds(updateDoc(doc(guest(), 'bookings/b1'), { status: 'paid_mock', paidAt: Timestamp.now() }));
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
      { status: 'checked_in', checkedInAt: Timestamp.now(), checkedInBy: 'host@x.com' }));
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
