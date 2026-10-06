import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const db = admin.firestore();

/**
 * Google Calendar Synchronization
 * 
 * PRD Requirements:
 * - Google Calendar acts as organizer scheduling source
 * - Firestore remains the application's operational read model
 * - Handle dropped notifications, expired channels, invalid sync tokens
 * - Reconciliation job restores consistency
 * - Existing registrations/attendance MUST NOT be deleted due to calendar changes
 */

interface CalendarConnection {
  id: string;
  userId: string;
  calendarId: string;
  channelId: string;
  resourceId: string;
  syncToken?: string;
  lastSyncAt?: admin.firestore.Timestamp;
  lastError?: string;
  active: boolean;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  extendedProperties?: { private?: { karterEventId?: string } };
}

/**
 * Scheduled reconciliation - runs daily to catch missed webhooks
 */
export const onCalendarSync = onSchedule(
  { schedule: 'every 6 hours', region: 'asia-south1' },
  async (event) => {
    logger.info('Starting calendar reconciliation');
    
    try {
      const connectionsSnap = await db
        .collection('calendarConnections')
        .where('active', '==', true)
        .get();

      for (const doc of connectionsSnap.docs) {
        await reconcileConnection(doc.id, doc.data() as CalendarConnection);
      }

      logger.info('Calendar reconciliation completed');
    } catch (error) {
      logger.error('Calendar reconciliation failed', { error });
    }
  }
);

/**
 * Callable for manual sync trigger
 */
export const syncCalendarManual = onCall<{ connectionId: string }>(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userSnap = await db.doc(`users/${request.auth.uid}`).get();
    const userData = userSnap.data();
    const isAdmin = userData?.roles?.includes('admin') ?? false;

    if (!isAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can trigger manual sync');
    }

    try {
      const connSnap = await db.doc(`calendarConnections/${request.data.connectionId}`).get();
      if (!connSnap.exists) {
        throw new HttpsError('not-found', 'Connection not found');
      }

      await reconcileConnection(request.data.connectionId, connSnap.data() as CalendarConnection);
      return { success: true };
    } catch (error) {
      logger.error('Manual calendar sync failed', { error });
      throw new HttpsError('internal', 'Sync failed');
    }
  }
);

/**
 * Webhook handler for Google Calendar push notifications
 */
export const calendarWebhook = onCall<{ connectionId: string; resourceId: string }>(
  { region: 'asia-south1' },
  async (request) => {
    // In production, this would be an HTTP trigger, not a callable
    // This is a placeholder for the actual webhook implementation
    logger.info('Calendar webhook received', { data: request.data });
    return { success: true };
  }
);

/**
 * Reconciles a single calendar connection
 */
async function reconcileConnection(connectionId: string, connection: CalendarConnection): Promise<void> {
  const calendar = getCalendarClient(connection.userId);
  if (!calendar) {
    await updateConnectionError(connectionId, 'No calendar client available');
    return;
  }

  try {
    // Fetch events from Google Calendar
    const events = await fetchCalendarEvents(calendar, connection.calendarId, connection.syncToken);
    
    // Process each event
    for (const gcalEvent of events.items || []) {
      await processCalendarEvent(connectionId, gcalEvent);
    }

    // Update sync token
    if (events.nextSyncToken) {
      await db.doc(`calendarConnections/${connectionId}`).update({
        syncToken: events.nextSyncToken,
        lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        lastError: admin.firestore.FieldValue.delete(),
      });
    }

    logger.info('Connection reconciled', { connectionId, eventsProcessed: events.items?.length || 0 });
  } catch (error) {
    logger.error('Connection reconciliation failed', { connectionId, error });
    await updateConnectionError(connectionId, error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Processes a single Google Calendar event
 */
async function processCalendarEvent(connectionId: string, gcalEvent: CalendarEvent): Promise<void> {
  // Extract Karter event ID from extended properties
  const karterEventId = gcalEvent.extendedProperties?.private?.karterEventId;
  
  if (!karterEventId) {
    // Not a Karter event, skip
    return;
  }

  // Check if event exists in Firestore
  const eventRef = db.doc(`events/${karterEventId}`);
  const eventSnap = await eventRef.get();

  const eventData = {
    title: gcalEvent.summary,
    description: gcalEvent.description,
    location: gcalEvent.location,
    startAt: gcalEvent.start.dateTime ? admin.firestore.Timestamp.fromDate(new Date(gcalEvent.start.dateTime)) : admin.firestore.Timestamp.fromDate(new Date(gcalEvent.start.date!)),
    endAt: gcalEvent.end.dateTime ? admin.firestore.Timestamp.fromDate(new Date(gcalEvent.end.dateTime)) : admin.firestore.Timestamp.fromDate(new Date(gcalEvent.end.date!)),
    timezone: gcalEvent.start.timeZone || 'UTC',
    gcalEventId: gcalEvent.id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (eventSnap.exists) {
    // Update existing event - but DON'T overwrite registrations/attendance
    await eventRef.update(eventData);
  } else {
    // Create new event with default values
    await eventRef.set({
      ...eventData,
      id: karterEventId,
      slug: karterEventId,
      status: 'SCHEDULED',
      visibility: 'PUBLIC',
      capacity: 0,
      confirmedAttendeeCount: 0,
      hostIds: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Fetches events from Google Calendar
 */
async function fetchCalendarEvents(
  calendar: any,
  calendarId: string,
  syncToken?: string
): Promise<{ items?: CalendarEvent[]; nextSyncToken?: string }> {
  // TODO: Implement actual Google Calendar API call
  // const response = await calendar.events.list({
  //   calendarId,
  //   syncToken,
  //   showDeleted: true,
  // });
  // return response.data;
  return { items: [], nextSyncToken: syncToken };
}

/**
 * Gets authenticated Google Calendar client for a user
 */
function getCalendarClient(userId: string): any {
  // TODO: Implement OAuth token retrieval and Calendar client creation
  return null;
}

/**
 * Updates connection with error
 */
async function updateConnectionError(connectionId: string, error: string): Promise<void> {
  await db.doc(`calendarConnections/${connectionId}`).update({
    lastError: error,
    lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}