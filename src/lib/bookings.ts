import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { logAudit } from './audit';
import { db } from './firebase';
import { applyDiscount } from './pricing';
import type { Booking, BookingEvent } from './types';

export { applyDiscount, type DiscountResult } from './pricing';

const bookingEventRef = (id: string) => doc(db, 'bookingEvents', id);
const bookingEventsCol = () => collection(db, 'bookingEvents');
const bookingRef = (id: string) => doc(db, 'bookings', id);
const bookingsCol = () => collection(db, 'bookings');

/* ---------- booking events ---------- */

/** Public listing: sales-open events PLUS hosted-but-closed ones (R49: the host set the event up, so
 * it can read "booking opening soon"). Two filtered listens are merged by id because the rules
 * only grant a list query provably constrained to `salesOpen == true` or `hosted == true`; an
 * unfiltered collection listen is rejected (see firestore.rules `bookingEvents` and
 * tests/rules/bookings.rules.test.ts). Callers must still check `salesOpen` before offering tickets. */
export function watchBookingEvents(
  cb: (events: BookingEvent[]) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  const open = new Map<string, BookingEvent>();
  const hosted = new Map<string, BookingEvent>();
  let ready = 0;
  const emit = () => {
    if (ready < 2) return;
    const all = new Map([...hosted, ...open]);
    cb([...all.values()]);
  };
  const listen = (field: 'salesOpen' | 'hosted', into: Map<string, BookingEvent>) => {
    let first = true;
    return onSnapshot(
      query(bookingEventsCol(), where(field, '==', true)),
      (s) => {
        into.clear();
        s.docs.forEach((d) => into.set(d.id, { ...d.data(), id: d.id } as BookingEvent));
        if (first) {
          first = false;
          ready += 1;
        }
        emit();
      },
      onErr,
    );
  };
  const u1 = listen('salesOpen', open);
  const u2 = listen('hosted', hosted);
  return () => {
    u1();
    u2();
  };
}

/** Host only: unfiltered listen over all booking events (open and closed). Allowed by firestore.rules
 * because `allow read: if resource.data.salesOpen == true || isHost();` passes every doc for a host. */
export function watchAllBookingEvents(
  cb: (events: BookingEvent[]) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    bookingEventsCol(),
    (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }) as BookingEvent)),
    onErr,
  );
}

export function watchBookingEvent(
  id: string,
  cb: (e: BookingEvent | null) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    bookingEventRef(id),
    (s) => cb(s.exists() ? ({ ...s.data(), id: s.id } as BookingEvent) : null),
    onErr,
  );
}

export type NewBookingEvent = Omit<BookingEvent, 'id' | 'bookedCount' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export async function createBookingEvent(data: NewBookingEvent): Promise<string> {
  const ref = data.id ? bookingEventRef(data.id) : doc(bookingEventsCol());
  await setDoc(ref, {
    ...data,
    id: ref.id,
    bookedCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  logAudit('booking-event.create', ref.id, data.title);
  return ref.id;
}

export async function updateBookingEvent(id: string, patch: Partial<BookingEvent>): Promise<void> {
  await updateDoc(bookingEventRef(id), { ...patch, updatedAt: serverTimestamp() });
  logAudit('booking-event.update', id, Object.keys(patch).join(', '));
}

/* ---------- bookings (guest side) ---------- */

export interface CreateReservationInput {
  bookingEventId: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string;
  tierId: string;
  qty: number;
  discountCode?: string;
}

/** Signed-in guest, own buyerUid. Reserves capacity via a transaction incrementing bookedCount;
 * throws a clear error if sold out. Price is computed client-side (trust boundary — see rules). */
export async function createReservation(input: CreateReservationInput): Promise<string> {
  const { bookingEventId, buyerUid, buyerName, buyerEmail, tierId, qty, discountCode } = input;
  const bookingId = doc(bookingsCol()).id;
  const evRef = bookingEventRef(bookingEventId);

  await runTransaction(db, async (tx) => {
    const evSnap = await tx.get(evRef);
    if (!evSnap.exists()) throw new Error('Booking event not found.');
    const ev = evSnap.data() as BookingEvent;
    if (!ev.salesOpen) throw new Error('Sales are closed for this event.');
    const nextCount = (ev.bookedCount ?? 0) + qty;
    if (nextCount > ev.capacity) throw new Error('Sold out — not enough seats left.');

    const tier = ev.tiers.find((t) => t.id === tierId);
    const discount = discountCode
      ? ev.discounts.find((d) => d.code?.toLowerCase() === discountCode.toLowerCase()) ?? null
      : null;
    const { unitPriceInr, discountAmountInr, totalInr } = applyDiscount(tier, discount, qty);

    tx.update(evRef, { bookedCount: nextCount, updatedAt: serverTimestamp() });
    tx.set(bookingRef(bookingId), {
      id: bookingId,
      bookingEventId,
      buyerUid,
      buyerName,
      buyerEmail,
      tierId,
      qty,
      unitPriceInr,
      ...(discountCode ? { discountCode } : {}),
      discountAmountInr,
      totalInr,
      status: 'reserved',
      qrToken: bookingId,
      createdAt: serverTimestamp(),
    });
  });

  return bookingId;
}

/** Buyer, own booking only. Mock payment: reserved -> paid_mock. No real payment is processed (R23). */
export async function markPaidMock(bookingId: string): Promise<void> {
  await updateDoc(bookingRef(bookingId), { status: 'paid_mock', paidAt: serverTimestamp() });
}

/** One booking by id. Rules only let the buyer (or a host) read it, so a guest asking for anyone
 * else's booking gets a permission error, never the data (R15). `null` = does not exist. */
export function watchBooking(
  id: string,
  cb: (b: Booking | null) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    bookingRef(id),
    (s) => cb(s.exists() ? ({ ...s.data(), id: s.id } as Booking) : null),
    onErr,
  );
}

/** Guest: own bookings only (R15). */
export function watchOwnBookings(uid: string, cb: (b: Booking[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  const q = query(bookingsCol(), where('buyerUid', '==', uid));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Booking)),
    onErr,
  );
}

/* ---------- bookings (host side) ---------- */

export function watchAllBookings(
  bookingEventId: string,
  cb: (b: Booking[]) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  const q = query(bookingsCol(), where('bookingEventId', '==', bookingEventId));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }) as Booking)),
    onErr,
  );
}

/** Host only. paid_mock -> checked_in; rejects if already checked in or not paid. */
export async function checkIn(bookingId: string, hostEmail: string): Promise<void> {
  const ref = bookingRef(bookingId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Booking not found.');
    const b = snap.data() as Booking;
    if (b.status === 'checked_in') throw new Error('Already checked in.');
    if (b.status !== 'paid_mock') throw new Error('Booking has not been paid yet.');
    tx.update(ref, {
      status: 'checked_in',
      checkedInAt: serverTimestamp(),
      checkedInBy: hostEmail,
    });
  });
  logAudit('booking.check-in', bookingId);
}

export type CancelErrorCode = 'not-found' | 'checked-in' | 'already-cancelled' | 'not-owner';
export class CancelBookingError extends Error {
  constructor(public readonly code: CancelErrorCode, message: string) {
    super(message);
    this.name = 'CancelBookingError';
  }
}

/** Cancel a booking (guest: own, host: any) in ONE transaction: flips status to 'cancelled' and
 * releases the seats by decrementing the event's bookedCount by qty. Only reserved/paid_mock can be
 * cancelled; checked_in and already-cancelled throw a typed CancelBookingError, so seats can never
 * be released twice. R23: mock payments only, so refund 'mock_refunded' is a label, no money moves. */
export async function cancelBooking(
  bookingId: string,
  by: 'guest' | 'host',
  reason?: string,
): Promise<void> {
  const ref = bookingRef(bookingId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new CancelBookingError('not-found', 'Booking not found.');
    const b = snap.data() as Booking;
    if (b.status === 'cancelled') throw new CancelBookingError('already-cancelled', 'Already cancelled.');
    if (b.status === 'checked_in') throw new CancelBookingError('checked-in', 'Checked-in bookings cannot be cancelled.');
    const evRef = bookingEventRef(b.bookingEventId);
    const evSnap = await tx.get(evRef);
    const trimmed = reason?.trim().slice(0, 200);
    tx.update(ref, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy: by,
      ...(trimmed ? { cancelReason: trimmed } : {}),
      refund: b.status === 'paid_mock' ? 'mock_refunded' : 'none',
    });
    if (evSnap.exists()) {
      const ev = evSnap.data() as BookingEvent;
      tx.update(evRef, {
        bookedCount: Math.max(0, (ev.bookedCount ?? 0) - b.qty),
        // Names the booking so firestore.rules can verify this decrease belongs to exactly this cancel.
        lastReleaseBookingId: bookingId,
        updatedAt: serverTimestamp(),
      });
    }
  });
  if (by === 'host') logAudit('booking.cancel', bookingId, reason?.trim() || undefined);
}

/** Host only. For scanner/manual search by booking id (== qrToken). */
export async function lookupBookingById(id: string): Promise<Booking | null> {
  const s = await getDoc(bookingRef(id));
  return s.exists() ? ({ ...s.data(), id: s.id } as Booking) : null;
}

// re-export Timestamp for consumers that need to build validFromUtc/validToUtc without importing firestore directly
export { Timestamp };
