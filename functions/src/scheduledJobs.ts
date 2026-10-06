import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const db = admin.firestore();

/**
 * Scheduled Jobs
 * 
 * PRD Requirements:
 * - Cost-conscious real-time behavior
 * - Background jobs should be event-driven or time-bounded
 * - Do not run background jobs 24/7 without justification
 */

// Runs every 5 minutes during race hours (Fri-Sun 10:00-22:00 IST)
export const raceWindowJobs = onSchedule(
  { 
    schedule: '*/5 10-22 * * 5,6,0', // Fri-Sun 10:00-22:00 IST
    region: 'asia-south1',
    timeZone: 'Asia/Kolkata',
  },
  async (event) => {
    logger.info('Running race window jobs');
    
    try {
      // Check for active races that need lock checking
      await checkActiveRaceLocks();
      
      // Update live leaderboards
      await updateLiveLeaderboards();
      
      logger.info('Race window jobs completed');
    } catch (error) {
      logger.error('Race window jobs failed', { error });
    }
  }
);

// Runs daily at 03:00 IST for maintenance
export const dailyMaintenance = onSchedule(
  { 
    schedule: '0 3 * * *',
    region: 'asia-south1',
    timeZone: 'Asia/Kolkata',
  },
  async (event) => {
    logger.info('Running daily maintenance');
    
    try {
      // Clean up old drafts
      await cleanupOldDrafts();
      
      // Reconcile calendar connections
      await reconcileCalendarConnections();
      
      // Check for stuck bookings
      await checkStuckBookings();
      
      // Archive old events
      await archiveOldEvents();
      
      logger.info('Daily maintenance completed');
    } catch (error) {
      logger.error('Daily maintenance failed', { error });
    }
  }
);

// Runs every hour to check prediction competition states
export const hourlyCompetitionCheck = onSchedule(
  { 
    schedule: '0 * * * *',
    region: 'asia-south1',
    timeZone: 'Asia/Kolkata',
  },
  async (event) => {
    try {
      await checkCompetitionStates();
    } catch (error) {
      logger.error('Hourly competition check failed', { error });
    }
  }
);

/**
 * Checks active races for lock conditions
 */
async function checkActiveRaceLocks(): Promise<void> {
  const activeSnap = await db.doc('settings/active').get();
  if (!activeSnap.exists) return;

  const eventId = activeSnap.data()?.eventId;
  if (!eventId) return;

  const eventSnap = await db.doc(`events/${eventId}`).get();
  if (!eventSnap.exists) return;

  const eventData = eventSnap.data();
  if (!eventData?.predictionCompetitionId) return;

  const compSnap = await db.doc(`predictionCompetitions/${eventData.predictionCompetitionId}`).get();
  if (!compSnap.exists) return;

  const compData = compSnap.data();
  if (compData?.status !== 'open') return;

  // Check if we should lock based on time (fallback if telemetry unavailable)
  const closesAt = eventData.closesAt.toMillis();
  if (Date.now() >= closesAt) {
    await db.doc(`predictionCompetitions/${eventData.predictionCompetitionId}`).update({
      status: 'locked',
      lockedAt: admin.firestore.FieldValue.serverTimestamp(),
      lockReason: 'Time-based lock (closesAt reached)',
    });
    logger.info('Locked competition via time-based fallback', { competitionId: eventData.predictionCompetitionId });
  }
}

/**
 * Updates live leaderboards for active competitions
 */
async function updateLiveLeaderboards(): Promise<void> {
  // This would update the precomputed leaderboard aggregates
  // Implementation depends on the specific competition state
  logger.debug('Updating live leaderboards');
}

/**
 * Cleans up old draft data
 */
async function cleanupOldDrafts(): Promise<void> {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
  const draftsSnap = await db.collection('drafts')
    .where('updatedAt', '<', admin.firestore.Timestamp.fromMillis(cutoff))
    .limit(500)
    .get();

  if (draftsSnap.empty) return;

  const batch = db.batch();
  for (const doc of draftsSnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  logger.info('Cleaned up old drafts', { count: draftsSnap.size });
}

/**
 * Reconciles calendar connections (catches missed webhooks)
 */
async function reconcileCalendarConnections(): Promise<void> {
  const connectionsSnap = await db.collection('calendarConnections')
    .where('active', '==', true)
    .get();

  for (const doc of connectionsSnap.docs) {
    const conn = doc.data();
    const lastSync = conn.lastSyncAt?.toMillis() || 0;
    const hoursSinceSync = (Date.now() - lastSync) / (1000 * 60 * 60);
    
    if (hoursSinceSync > 12) {
      logger.warn('Calendar connection needs reconciliation', { 
        connectionId: doc.id, 
        hoursSinceSync 
      });
      // In production, trigger the reconciliation logic
    }
  }
}

/**
 * Checks for stuck bookings (reserved but not paid for too long)
 */
async function checkStuckBookings(): Promise<void> {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes
  const bookingsSnap = await db.collection('bookings')
    .where('status', '==', 'reserved')
    .where('createdAt', '<', admin.firestore.Timestamp.fromMillis(cutoff))
    .limit(100)
    .get();

  for (const doc of bookingsSnap.docs) {
    const booking = doc.data();
    logger.warn('Stuck booking found', { 
      bookingId: doc.id, 
      eventId: booking.bookingEventId,
      createdAt: booking.createdAt?.toMillis() 
    });
    // Could auto-cancel or notify
  }
}

/**
 * Archives old completed events
 */
async function archiveOldEvents(): Promise<void> {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000; // 90 days
  const eventsSnap = await db.collection('events')
    .where('status', '==', 'COMPLETED')
    .where('updatedAt', '<', admin.firestore.Timestamp.fromMillis(cutoff))
    .limit(50)
    .get();

  for (const doc of eventsSnap.docs) {
    await doc.ref.update({ status: 'ARCHIVED' });
  }

  if (!eventsSnap.empty) {
    logger.info('Archived old events', { count: eventsSnap.size });
  }
}

/**
 * Checks prediction competition states and transitions
 */
async function checkCompetitionStates(): Promise<void> {
  const now = Date.now();
  
  // Find competitions that should transition
  const compsSnap = await db.collection('predictionCompetitions')
    .where('status', 'in', ['published', 'open', 'locked', 'awaiting_data'])
    .limit(50)
    .get();

  for (const doc of compsSnap.docs) {
    const comp = doc.data();
    
    // Check various state transitions
    if (comp.status === 'published' && comp.opensAt?.toMillis() <= now) {
      await doc.ref.update({ status: 'open' });
    } else if (comp.status === 'open' && comp.closesAt?.toMillis() <= now) {
      await doc.ref.update({ status: 'locked', lockReason: 'Time-based lock' });
    } else if (comp.status === 'locked' && comp.raceFinishedAt?.toMillis() <= now) {
      await doc.ref.update({ status: 'awaiting_data' });
    }
  }
}