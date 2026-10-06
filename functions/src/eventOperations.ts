import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const db = admin.firestore();

/**
 * Event Operations - Server-side event management
 * 
 * PRD Requirements:
 * - Sensitive operations MUST be performed through trusted backend code
 * - Admin overrides are audited
 * - Payment confirmation is server-side
 * - Ticket generation is server-side
 */

interface EventOperationInput {
  operation: 'extend_closes' | 'set_override' | 'cancel_event' | 'verify_payment' | 'issue_ticket' | 'check_in';
  eventId: string;
  data: Record<string, unknown>;
}

/**
 * Main event operations handler
 */
export const onEventOperations = onCall<EventOperationInput>(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // Check permissions
    const userSnap = await db.doc(`users/${request.auth.uid}`).get();
    const userData = userSnap.data();
    const isAdmin = userData?.roles?.includes('admin') ?? false;
    const isHost = userData?.roles?.includes('host') ?? false;
    const canRunBookings = isAdmin || isHost || (userData?.roles?.includes('venue_host') ?? false);

    const { operation, eventId, data } = request.data;

    try {
      switch (operation) {
        case 'extend_closes':
          if (!isHost && !isAdmin) throw new HttpsError('permission-denied', 'Host/admin required');
          return await extendCloses(eventId, data.minutes as number, request.auth.uid);

        case 'set_override':
          if (!isHost && !isAdmin) throw new HttpsError('permission-denied', 'Host/admin required');
          return await setOverride(eventId, data.override as 'open' | 'closed' | 'none', request.auth.uid);

        case 'cancel_event':
          if (!isAdmin) throw new HttpsError('permission-denied', 'Admin required');
          return await cancelEvent(eventId, data.reason as string, request.auth.uid);

        case 'verify_payment':
          if (!canRunBookings) throw new HttpsError('permission-denied', 'Booking permissions required');
          return await verifyPayment(eventId, data.bookingId as string, data.verifiedBy as string);

        case 'issue_ticket':
          if (!canRunBookings) throw new HttpsError('permission-denied', 'Booking permissions required');
          return await issueTicket(eventId, data.bookingId as string);

        case 'check_in':
          if (!canRunBookings) throw new HttpsError('permission-denied', 'Booking permissions required');
          return await checkInBooking(eventId, data.bookingId as string, request.auth.token.email || 'unknown');

        default:
          throw new HttpsError('invalid-argument', `Unknown operation: ${operation}`);
      }
    } catch (error) {
      logger.error('Event operation failed', { operation, eventId, error });
      if (error instanceof HttpsError) throw error;
      throw new HttpsError('internal', 'Operation failed');
    }
  }
);

/**
 * Extends the closesAt timestamp for an event
 */
async function extendCloses(eventId: string, minutes: number, actorId: string): Promise<{ success: boolean }> {
  if (!Number.isInteger(minutes)) {
    throw new HttpsError('invalid-argument', 'Minutes must be an integer');
  }

  await db.runTransaction(async (transaction) => {
    const eventRef = db.doc(`events/${eventId}`);
    const snap = await transaction.get(eventRef);
    
    if (!snap.exists) throw new HttpsError('not-found', 'Event not found');
    
    const eventData = snap.data()!;
    const currentClosesAt = eventData.closesAt.toMillis();
    const newClosesAt = currentClosesAt + minutes * 60 * 1000;
    
    transaction.update(eventRef, {
      closesAt: admin.firestore.Timestamp.fromMillis(newClosesAt),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  // Audit log
  await logAudit('event.extend-closes', eventId, `${minutes > 0 ? '+' : ''}${minutes} min`, actorId);

  return { success: true };
}

/**
 * Sets manual override on event
 */
async function setOverride(eventId: string, override: 'open' | 'closed' | 'none', actorId: string): Promise<{ success: boolean }> {
  const validOverrides = ['open', 'closed', 'none'];
  if (!validOverrides.includes(override)) {
    throw new HttpsError('invalid-argument', 'Invalid override value');
  }

  await db.runTransaction(async (transaction) => {
    const eventRef = db.doc(`events/${eventId}`);
    const snap = await transaction.get(eventRef);
    
    if (!snap.exists) throw new HttpsError('not-found', 'Event not found');
    
    // Override 'open' can never pass closesAt
    if (override === 'open') {
      const eventData = snap.data()!;
      const now = Date.now();
      if (now >= eventData.closesAt.toMillis()) {
        throw new HttpsError('failed-precondition', 'Cannot open after closesAt');
      }
    }

    transaction.update(eventRef, {
      override,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await logAudit('event.override', eventId, `override=${override}`, actorId);

  return { success: true };
}

/**
 * Cancels an event
 */
async function cancelEvent(eventId: string, reason: string, actorId: string): Promise<{ success: boolean }> {
  await db.runTransaction(async (transaction) => {
    const eventRef = db.doc(`events/${eventId}`);
    const snap = await transaction.get(eventRef);
    
    if (!snap.exists) throw new HttpsError('not-found', 'Event not found');
    
    const eventData = snap.data()!;
    if (eventData.status === 'COMPLETED' || eventData.status === 'CANCELLED') {
      throw new HttpsError('failed-precondition', 'Cannot cancel completed or already cancelled event');
    }

    transaction.update(eventRef, {
      status: 'CANCELLED',
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
      cancelledBy: actorId,
      cancelReason: reason?.slice(0, 500),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  await logAudit('event.cancel', eventId, reason || 'No reason provided', actorId);

  return { success: true };
}

/**
 * Verifies a payment (for manual UPI/UTR flow)
 */
async function verifyPayment(eventId: string, bookingId: string, verifiedBy: string): Promise<{ success: boolean }> {
  await db.runTransaction(async (transaction) => {
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const snap = await transaction.get(bookingRef);
    
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
    
    const bookingData = snap.data()!;
    if (bookingData.bookingEventId !== eventId) {
      throw new HttpsError('invalid-argument', 'Booking does not belong to this event');
    }
    if (bookingData.status !== 'reserved') {
      throw new HttpsError('failed-precondition', 'Booking not in reserved state');
    }

    transaction.update(bookingRef, {
      status: 'paid_mock',
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      verifiedBy,
    });
  });

  await logAudit('payment.verify', bookingId, `Verified by ${verifiedBy}`, verifiedBy);

  return { success: true };
}

/**
 * Issues a ticket for a confirmed booking
 */
async function issueTicket(eventId: string, bookingId: string): Promise<{ success: boolean; ticketId?: string }> {
  const bookingRef = db.doc(`bookings/${bookingId}`);
  const snap = await bookingRef.get();
  
  if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
  
  const bookingData = snap.data()!;
  if (bookingData.bookingEventId !== eventId) {
    throw new HttpsError('invalid-argument', 'Booking does not belong to this event');
  }
  if (bookingData.status !== 'paid_mock' && bookingData.status !== 'checked_in') {
    throw new HttpsError('failed-precondition', 'Booking must be paid before issuing ticket');
  }

  // Ticket already exists (qrToken == bookingId)
  return { success: true, ticketId: bookingId };
}

/**
 * Checks in a booking
 */
async function checkInBooking(eventId: string, bookingId: string, hostEmail: string): Promise<{ success: boolean }> {
  await db.runTransaction(async (transaction) => {
    const bookingRef = db.doc(`bookings/${bookingId}`);
    const snap = await transaction.get(bookingRef);
    
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
    
    const bookingData = snap.data()!;
    if (bookingData.bookingEventId !== eventId) {
      throw new HttpsError('invalid-argument', 'Booking does not belong to this event');
    }
    if (bookingData.status === 'checked_in') {
      throw new HttpsError('failed-precondition', 'Already checked in');
    }
    if (bookingData.status !== 'paid_mock') {
      throw new HttpsError('failed-precondition', 'Booking not paid');
    }

    transaction.update(bookingRef, {
      status: 'checked_in',
      checkedInAt: admin.firestore.FieldValue.serverTimestamp(),
      checkedInBy: hostEmail,
    });
  });

  await logAudit('booking.check-in', bookingId, `Checked in by ${hostEmail}`, hostEmail);

  return { success: true };
}

/**
 * Audit logging helper
 */
async function logAudit(action: string, target: string, detail: string, actor: string): Promise<void> {
  await db.collection('auditLogs').add({
    action,
    actor,
    target,
    detail,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });
}