import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const db = admin.firestore();

/**
 * Prediction Lock Engine
 * 
 * Implements the 1/3-distance lock for live prediction competitions.
 * This is a backend-authoritative lock - the frontend timer is never authoritative.
 * 
 * PRD Requirements:
 * - Lock at configurable 1/3 race distance (default 33.33%)
 * - Backend determines threshold, not frontend
 * - Handle safety cars, red flags, delayed starts, restarts
 * - Fail safely rather than prematurely locking due to bad data
 */

interface LockConfig {
  lockDistanceFraction: number; // default 0.333333
  minLapsForLock: number; // minimum laps before lock can trigger
}

const DEFAULT_CONFIG: LockConfig = {
  lockDistanceFraction: 0.333333,
  minLapsForLock: 1,
};

interface RaceTelemetry {
  leaderLap: number;
  totalLaps: number;
  raceStatus: 'racing' | 'safety_car' | 'red_flag' | 'finished' | 'not_started';
  sessionKey: string;
}

/**
 * Calculates if the race has reached the lock threshold
 */
function hasReachedLockThreshold(telemetry: RaceTelemetry, config: LockConfig): boolean {
  // Race not started yet
  if (telemetry.raceStatus === 'not_started') {
    return false;
  }

  // Race finished - definitely lock
  if (telemetry.raceStatus === 'finished') {
    return true;
  }

  // Need minimum laps
  if (telemetry.leaderLap < config.minLapsForLock) {
    return false;
  }

  // During safety car or red flag, be conservative - don't lock prematurely
  if (telemetry.raceStatus === 'safety_car' || telemetry.raceStatus === 'red_flag') {
    // Only lock if we're well past the threshold
    const effectiveFraction = config.lockDistanceFraction * 1.5; // 50% instead of 33%
    return (telemetry.leaderLap / telemetry.totalLaps) >= effectiveFraction;
  }

  // Normal racing - check standard threshold
  const progress = telemetry.leaderLap / telemetry.totalLaps;
  return progress >= config.lockDistanceFraction;
}

/**
 * Gets the active prediction competition
 */
async function getActiveCompetition(): Promise<{ id: string; config: LockConfig } | null> {
  const activeSnap = await db.doc('settings/active').get();
  if (!activeSnap.exists) return null;
  
  const activeData = activeSnap.data();
  if (!activeData?.eventId) return null;

  const eventSnap = await db.doc(`events/${activeData.eventId}`).get();
  if (!eventSnap.exists) return null;

  const eventData = eventSnap.data();
  if (!eventData?.predictionCompetitionId) return null;

  // Get competition config
  const compSnap = await db.doc(`predictionCompetitions/${eventData.predictionCompetitionId}`).get();
  if (!compSnap.exists) return null;

  const compData = compSnap.data();
  const config: LockConfig = {
    lockDistanceFraction: compData?.lockDistanceFraction ?? DEFAULT_CONFIG.lockDistanceFraction,
    minLapsForLock: compData?.minLapsForLock ?? DEFAULT_CONFIG.minLapsForLock,
  };

  return { id: eventData.predictionCompetitionId, config };
}

/**
 * Locks the competition - prevents new submissions
 */
async function lockCompetition(competitionId: string, reason: string): Promise<void> {
  const compRef = db.doc(`predictionCompetitions/${competitionId}`);
  
  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(compRef);
    if (!snap.exists) {
      throw new Error('Competition not found');
    }

    const data = snap.data();
    if (data?.status === 'locked' || data?.status === 'scored') {
      logger.info(`Competition ${competitionId} already locked`);
      return;
    }

    transaction.update(compRef, {
      status: 'locked',
      lockedAt: admin.firestore.FieldValue.serverTimestamp(),
      lockReason: reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  logger.info(`Locked competition ${competitionId}: ${reason}`);
}

/**
 * Main function to check and apply prediction lock
 * Called via scheduled function or HTTP trigger
 */
export const onPredictionLock = onCall<{ force?: boolean }>(
  { region: 'asia-south1', secrets: ['OPENF1_API_KEY'] },
  async (request) => {
    // Only allow admins/hosts to trigger manually
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userSnap = await db.doc(`users/${request.auth.uid}`).get();
    const userData = userSnap.data();
    const isAdmin = userData?.roles?.includes('admin') ?? false;
    const isHost = userData?.roles?.includes('host') ?? false;

    if (!isAdmin && !isHost && !request.data?.force) {
      throw new HttpsError('permission-denied', 'Only admins/hosts can manually trigger lock check');
    }

    try {
      const competition = await getActiveCompetition();
      if (!competition) {
        return { success: false, reason: 'No active competition' };
      }

      // Fetch current race telemetry from OpenF1
      const telemetry = await fetchRaceTelemetry(competition.id);
      if (!telemetry) {
        return { success: false, reason: 'Could not fetch race telemetry' };
      }

      const shouldLock = hasReachedLockThreshold(telemetry, competition.config);
      
      if (shouldLock) {
        await lockCompetition(competition.id, `1/3-distance reached (lap ${telemetry.leaderLap}/${telemetry.totalLaps})`);
        return { success: true, locked: true, reason: `Locked at lap ${telemetry.leaderLap}/${telemetry.totalLaps}` };
      }

      return { success: true, locked: false, progress: telemetry.leaderLap / telemetry.totalLaps };
    } catch (error) {
      logger.error('Prediction lock check failed', { error });
      throw new HttpsError('internal', 'Failed to check prediction lock');
    }
  }
);

/**
 * Fetches current race telemetry from OpenF1
 */
async function fetchRaceTelemetry(competitionId: string): Promise<RaceTelemetry | null> {
  try {
    // Get the event to find the race/session
    const activeSnap = await db.doc('settings/active').get();
    if (!activeSnap.exists) return null;
    
    const eventId = activeSnap.data()?.eventId;
    if (!eventId) return null;

    const eventSnap = await db.doc(`events/${eventId}`).get();
    if (!eventSnap.exists) return null;

    const eventData = eventSnap.data();
    const sessionKey = eventData?.sessionKey; // OpenF1 session key
    
    if (!sessionKey) {
      logger.warn('No sessionKey on event', { eventId });
      return null;
    }

    // In production, call OpenF1 API
    // For now, return mock data structure
    // TODO: Implement actual OpenF1 API call
    return {
      leaderLap: 0,
      totalLaps: 50,
      raceStatus: 'not_started',
      sessionKey,
    };
  } catch (error) {
    logger.error('Failed to fetch race telemetry', { error });
    return null;
  }
}