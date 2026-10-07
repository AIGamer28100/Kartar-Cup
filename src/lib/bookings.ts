import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
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
import { auth, db } from './firebase';
import { applyDiscount } from './pricing';
import type { Booking, BookingEvent } from './types';

export { applyDiscount, type DiscountResult } from './pricing';

const bookingEventRef = (id: string) => doc(db, 'bookingEvents', id);
const bookingEventsCol = () => collection(db, 'bookingEvents');
const bookingRef = (id: string) => doc(db, 'bookings', id);
const bookingsCol = () => collection(db, 'bookings');
/** Per-tier ticket counters, enforced by firestore.rules (tierCounts / tierWithinCapacity). */
const tierCountRef = (eventId: string, tierId: string) => doc(db, 'bookingEvents', eventId, 'tierCounts', tierId);

/** Live tickets-sold per tier id for an event (missing = 0). Public read. */
export function watchTierCounts(
  eventId: string,
  cb: (counts: Record<string, number>) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'bookingEvents', eventId, 'tierCounts'),
    (snap) => {
      const out: Record<string, number> = {};
      snap.docs.forEach((d) => { out[d.id] = Number(d.data().booked) || 0; });
      cb(out);
    },
    onErr,
  );
}

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
 * because `allow read: if salesOpen == true || hosted == true || canRunBookings();` passes every doc for them. */
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

/** One-shot read of a booking event (null when it does not exist). */
export async function getBookingEvent(id: string): Promise<BookingEvent | null> {
  const s = await getDoc(bookingEventRef(id));
  return s.exists() ? ({ ...s.data(), id: s.id } as BookingEvent) : null;
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

/** 128 random bits as hex: the ticket's QR content. Not guessable, contains no PII. */
export function newQrToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CreateReservationInput {
  bookingEventId: string;
  buyerUid: string;
  buyerName: string;
  buyerEmail: string;
  tierId: string;
  qty: number;
  discountCode?: string;
}

/** Signed-in guest, own buyerUid. One transaction: bumps the event's bookedCount AND the tier's
 * ticket counter, then writes the booking. Firestore rules re-check the tier price/discount against
 * the event and the exact counter increments, so this client cannot under-charge or oversell. */
export async function createReservation(input: CreateReservationInput): Promise<string> {
  const { bookingEventId, buyerUid, buyerName, buyerEmail, tierId, qty, discountCode } = input;
  const bookingId = doc(bookingsCol()).id;
  // The QR token is a separate secret: the booking id is named on public counters (see firestore.rules).
  const qrToken = newQrToken();
  const evRef = bookingEventRef(bookingEventId);

  await runTransaction(db, async (tx) => {
    const countRef = tierCountRef(bookingEventId, tierId);
    const [evSnap, countSnap] = await Promise.all([tx.get(evRef), tx.get(countRef)]);
    if (!evSnap.exists()) throw new Error('Booking event not found.');
    const ev = evSnap.data() as BookingEvent;
    if (!ev.salesOpen) throw new Error('Sales are closed for this event.');

    const tierIndex = ev.tiers.findIndex((t) => t.id === tierId);
    const tier = ev.tiers[tierIndex];
    if (!tier) throw new Error('Price tier not found.');

    const seatsPerTicket = tier.seatsPerTicket ?? 1;
    const seatsRequested = qty * seatsPerTicket;

    // Check event-level capacity
    const nextEventCount = (ev.bookedCount ?? 0) + seatsRequested;
    if (nextEventCount > ev.capacity) throw new Error('Sold out — not enough seats left.');

    // Tier-level capacity (tickets, not seats; 0 = unlimited).
    const tierSold = countSnap.exists() ? Number(countSnap.data().booked) || 0 : 0;
    if (tier.capacity && tier.capacity > 0 && tierSold + qty > tier.capacity) {
      throw new Error(`${tier.label} is sold out.`);
    }

    const discountIndex = discountCode
      ? ev.discounts.findIndex((d) => d.code?.toLowerCase() === discountCode.toLowerCase())
      : -1;
    const discount = discountIndex >= 0 ? ev.discounts[discountIndex] : null;
    const { unitPriceInr, discountAmountInr, totalInr, rejectedReason } = applyDiscount(tier, discount, qty);
    // Only record a discount that actually applied; the rules verify code, index and amount.
    const discountApplied = discount !== null && rejectedReason === null;

    // Both counters name this booking so firestore.rules can tie the bump to a real booking of ours.
    tx.update(evRef, { bookedCount: nextEventCount, lastReserveBookingId: bookingId, updatedAt: serverTimestamp() });
    tx.set(countRef, { booked: tierSold + qty, lastBookingId: bookingId, updatedAt: serverTimestamp() });
    tx.set(bookingRef(bookingId), {
      id: bookingId,
      bookingEventId,
      buyerUid,
      buyerName,
      buyerEmail,
      tierId,
      tierIndex,
      qty,
      seatsPerTicket,
      unitPriceInr,
      ...(discountApplied ? { discountCode: discount!.code, discountIndex } : {}),
      discountAmountInr,
      totalInr,
      status: 'reserved',
      qrToken,
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

/** Host only. paid_mock -> checked_in; rejects if already fully checked in or not paid. 
 * Supports partial check-in for bundled tickets: pass `count` to check in a specific number of seats. */
export async function checkIn(
  bookingId: string,
  hostEmail: string,
  count?: number
): Promise<void> {
  const ref = bookingRef(bookingId);
  let loggedCount = 0;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error('Booking not found.');
    const b = snap.data() as Booking;
    
    const seatsPerTicket = b.seatsPerTicket ?? 1;
    const totalSeats = b.qty * seatsPerTicket;
    const alreadyCheckedIn = b.checkedInCount ?? 0;
    
    // If no count specified, check in all remaining
    const toCheckIn = count ?? (totalSeats - alreadyCheckedIn);
    if (!Number.isInteger(toCheckIn) || toCheckIn < 1) throw new Error('Check in at least one seat.');
    const newCheckedInCount = alreadyCheckedIn + toCheckIn;
    
    if (newCheckedInCount > totalSeats) {
      throw new Error(`Cannot check in ${toCheckIn} seats: only ${totalSeats - alreadyCheckedIn} remaining.`);
    }
    
    if (b.status !== 'paid_mock') throw new Error('Booking has not been paid yet.');
    if (alreadyCheckedIn >= totalSeats) throw new Error('Already fully checked in.');
    
    const isFullyCheckedIn = newCheckedInCount >= totalSeats;
    
    loggedCount = toCheckIn;
    tx.update(ref, {
      checkedInCount: newCheckedInCount,
      status: isFullyCheckedIn ? 'checked_in' : 'paid_mock',
      ...(isFullyCheckedIn ? { checkedInAt: serverTimestamp() } : {}),
      checkedInBy: hostEmail,
    });
  });
  logAudit('booking.check-in', bookingId, `count=${loggedCount}`);
}

export type CancelErrorCode = 'not-found' | 'checked-in' | 'already-cancelled' | 'not-host';
export class CancelBookingError extends Error {
  constructor(public readonly code: CancelErrorCode, message: string) {
    super(message);
    this.name = 'CancelBookingError';
  }
}

/** Cancel a booking (host only) in ONE transaction: flips status to 'cancelled' and
 * releases the seats by decrementing the event's bookedCount by qty. Only reserved/paid_mock can be
 * cancelled; checked_in and already-cancelled throw a typed CancelBookingError, so seats can never
 * be released twice. R23: mock payments only, so refund 'mock_refunded' is a label, no money moves. */
export async function cancelBooking(
  bookingId: string,
  reason?: string,
): Promise<void> {
  const hostEmail = auth.currentUser?.email?.toLowerCase();
  if (!hostEmail) throw new CancelBookingError('not-found', 'Sign in as a host to cancel a booking.');
  const ref = bookingRef(bookingId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new CancelBookingError('not-found', 'Booking not found.');
    const b = snap.data() as Booking;
    if (b.status === 'cancelled') throw new CancelBookingError('already-cancelled', 'Already cancelled.');
    const evRef = bookingEventRef(b.bookingEventId);
    const countRef = tierCountRef(b.bookingEventId, b.tierId);
    const [evSnap, countSnap] = await Promise.all([tx.get(evRef), tx.get(countRef)]);
    // Someone already at the door cannot be cancelled, unless the whole event was cancelled.
    if (b.status === 'checked_in' && !(evSnap.exists() && (evSnap.data() as BookingEvent).cancelled)) {
      throw new CancelBookingError('checked-in', 'Checked-in bookings cannot be cancelled.');
    }
    const trimmed = reason?.trim().slice(0, 200);
    tx.update(ref, {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy: hostEmail,
      ...(trimmed ? { cancelReason: trimmed } : {}),
      refund: b.status === 'reserved' ? 'none' : 'mock_refunded',
    });
    // The rules require the seat release in the same write; a missing event would fail opaquely.
    if (!evSnap.exists()) throw new CancelBookingError('not-found', 'The booking event no longer exists.');
    {
      const ev = evSnap.data() as BookingEvent;
      const seatsToRelease = b.qty * (b.seatsPerTicket ?? 1);
      tx.update(evRef, {
        bookedCount: (ev.bookedCount ?? 0) - seatsToRelease,
        // Names the booking so firestore.rules can verify this decrease belongs to exactly this cancel.
        lastReleaseBookingId: bookingId,
        updatedAt: serverTimestamp(),
      });
    }
    if (countSnap.exists()) {
      const sold = Number(countSnap.data().booked) || 0;
      tx.set(countRef, { booked: Math.max(0, sold - b.qty), updatedAt: serverTimestamp() });
    }
  });
  logAudit('booking.cancel', bookingId, reason?.trim() || undefined);
}

/** Host only. The scanner reads a QR (the booking's qrToken) or a typed booking id: tries the id first
 * (older tickets used the id as their token), then looks the token up. */
export async function lookupBookingById(idOrToken: string): Promise<Booking | null> {
  const key = idOrToken.trim();
  if (!key) return null;
  const direct = await getDoc(bookingRef(key));
  if (direct.exists()) return { ...direct.data(), id: direct.id } as Booking;
  const hit = await getDocs(query(bookingsCol(), where('qrToken', '==', key), limit(1)));
  const d = hit.docs[0];
  return d ? ({ ...d.data(), id: d.id } as Booking) : null;
}

/* ---------- cancelling a whole event (never a delete: the records stay for audit) ---------- */

/** Host: mark the event cancelled and close sales. From this moment guests see it as cancelled. Idempotent.
 * Follow with settleCancelledEvent to cancel and refund every ticket. */
export async function cancelBookingEvent(eventId: string, reason?: string): Promise<void> {
  const email = auth.currentUser?.email?.toLowerCase();
  if (!email) throw new Error('Sign in as a host to cancel an event.');
  const trimmed = reason?.trim().slice(0, 300);
  await updateDoc(bookingEventRef(eventId), {
    cancelled: true,
    salesOpen: false,
    cancelledAt: serverTimestamp(),
    cancelledBy: email,
    ...(trimmed ? { cancelReason: trimmed } : {}),
    updatedAt: serverTimestamp(),
  });
  logAudit('booking-event.cancel', eventId, trimmed || undefined);
}

/** Host: every booking of the event that is not yet cancelled (these still need cancelling + refunding). */
export async function pendingEventRefunds(eventId: string): Promise<Booking[]> {
  const snap = await getDocs(query(bookingsCol(), where('bookingEventId', '==', eventId)));
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.id }) as Booking)
    .filter((b) => b.status !== 'cancelled');
}

export interface SettleResult {
  cancelled: number;
  failed: number;
}

/** Host: cancel (and mock-refund) every remaining booking of a cancelled event, one transaction each,
 * then stamp `cancelSettledAt`. Safe to run again after a failure: only what is left is processed. */
export async function settleCancelledEvent(
  eventId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<SettleResult> {
  const pending = await pendingEventRefunds(eventId);
  let cancelled = 0;
  let failed = 0;
  for (const b of pending) {
    try {
      await cancelBooking(b.id, 'Event cancelled');
      cancelled++;
    } catch {
      failed++;
    }
    onProgress?.(cancelled + failed, pending.length);
  }
  if (failed === 0) {
    await updateDoc(bookingEventRef(eventId), { cancelSettledAt: serverTimestamp(), updatedAt: serverTimestamp() });
    logAudit('booking-event.settled', eventId, `${cancelled} tickets cancelled and refunded`);
  }
  return { cancelled, failed };
}

// re-export Timestamp for consumers that need to build validFromUtc/validToUtc without importing firestore directly
export { Timestamp };
