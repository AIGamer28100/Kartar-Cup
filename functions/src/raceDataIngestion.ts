import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const db = admin.firestore();

/**
 * Race Data Ingestion from OpenF1
 * 
 * PRD Requirements:
 * - External F1 providers abstracted behind F1DataProvider interface
 * - Provider data normalized into canonical RaceFacts
 * - Validation policies for telemetry data
 * - Store both raw provider data and normalized race facts
 * - Handle provider failures gracefully
 */

interface OpenF1Session {
  session_key: number;
  meeting_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  circuit_short_name: string;
  country_code: string;
  location: string;
  year: number;
}

interface OpenF1Lap {
  session_key: number;
  driver_number: number;
  lap_number: number;
  lap_duration: number;
  sector_1: number;
  sector_2: number;
  sector_3: number;
  is_pit_out_lap: boolean;
  date_start: string;
}

interface OpenF1PitStop {
  session_key: number;
  driver_number: number;
  lap_number: number;
  pit_duration: number;
  date: string;
}

interface OpenF1Position {
  session_key: number;
  driver_number: number;
  position: number;
  date: string;
}

interface RaceFact {
  id: string;
  raceId: string;
  metricKey: 'RACE_WINNER' | 'FASTEST_LAP' | 'FASTEST_PIT_STOP' | 'SLOWEST_PIT_STOP' | 'TOP_SPEED';
  entityType: 'DRIVER' | 'TEAM' | 'SESSION';
  entityId: string;
  value: number | string;
  unit?: string;
  sourceProvider: string;
  sourceRecordId?: string;
  retrievedAt: admin.firestore.Timestamp;
  validationStatus: 'VALID' | 'INVALID' | 'AMBIGUOUS' | 'NOT_SUPPORTED' | 'PENDING';
  confidence?: number;
}

interface PitStopValidationPolicy {
  minimumValidDuration?: number; // seconds
  maximumValidDuration?: number; // seconds
  excludeIncomplete: boolean;
  excludePenaltyRelated: boolean;
  excludeNonStandardStops: boolean;
}

const DEFAULT_PIT_STOP_POLICY: PitStopValidationPolicy = {
  minimumValidDuration: 1.5,
  maximumValidDuration: 60,
  excludeIncomplete: true,
  excludePenaltyRelated: true,
  excludeNonStandardStops: true,
};

/**
 * Scheduled function to ingest race data during active race windows
 * Runs every 30 seconds during race hours
 */
export const onRaceDataIngestion = onSchedule(
  { schedule: 'every 30 minutes', region: 'asia-south1', secrets: ['OPENF1_API_KEY'] },
  async (event) => {
    logger.info('Starting scheduled race data ingestion');
    
    try {
      // Check if there's an active race
      const activeSnap = await db.doc('settings/active').get();
      if (!activeSnap.exists) {
        logger.info('No active event, skipping ingestion');
        return;
      }

      const eventId = activeSnap.data()?.eventId;
      if (!eventId) return;

      const eventSnap = await db.doc(`events/${eventId}`).get();
      if (!eventSnap.exists) return;

      const eventData = eventSnap.data();
      const sessionKey = eventData?.sessionKey;
      
      if (!sessionKey) {
        logger.warn('No sessionKey for event', { eventId });
        return;
      }

      // Only ingest if race is live or recently finished
      const raceStatus = eventData?.raceStatus;
      if (raceStatus !== 'racing' && raceStatus !== 'finished' && raceStatus !== 'safety_car') {
        logger.info('Race not in ingestible state', { eventId, raceStatus });
        return;
      }

      await ingestRaceData(eventId, sessionKey);
      logger.info('Race data ingestion completed', { eventId });
    } catch (error) {
      logger.error('Race data ingestion failed', { error });
      // Don't throw - let the scheduler continue
    }
  }
);

/**
 * Callable function for manual race data ingestion
 */
export const ingestRaceDataManual = onCall<{ eventId: string; sessionKey: number }>(
  { region: 'asia-south1', secrets: ['OPENF1_API_KEY'] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userSnap = await db.doc(`users/${request.auth.uid}`).get();
    const userData = userSnap.data();
    const isAdmin = userData?.roles?.includes('admin') ?? false;
    const isHost = userData?.roles?.includes('host') ?? false;

    if (!isAdmin && !isHost) {
      throw new HttpsError('permission-denied', 'Only admins/hosts can trigger ingestion');
    }

    try {
      await ingestRaceData(request.data.eventId, request.data.sessionKey);
      return { success: true };
    } catch (error) {
      logger.error('Manual race data ingestion failed', { error });
      throw new HttpsError('internal', 'Failed to ingest race data');
    }
  }
);

/**
 * Core ingestion logic
 */
async function ingestRaceData(eventId: string, sessionKey: number): Promise<void> {
  const providerRunId = `openf1_${sessionKey}_${Date.now()}`;
  
  try {
    // Create provider run record
    await db.doc(`raceProviderRuns/${providerRunId}`).set({
      eventId,
      sessionKey,
      provider: 'openf1',
      status: 'running',
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Fetch data from OpenF1 (mock for now - implement actual API calls)
    const [laps, pitStops, positions] = await Promise.all([
      fetchLaps(sessionKey),
      fetchPitStops(sessionKey),
      fetchPositions(sessionKey),
    ]);

    // Store raw data snapshot
    await db.doc(`raceDataSnapshots/${eventId}_${providerRunId}`).set({
      eventId,
      sessionKey,
      provider: 'openf1',
      providerRunId,
      laps,
      pitStops,
      positions,
      retrievedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Normalize into canonical race facts
    const raceFacts = normalizeRaceFacts(eventId, sessionKey, laps, pitStops, positions);
    
    // Store race facts
    const batch = db.batch();
    for (const fact of raceFacts) {
      const factRef = db.doc(`raceFacts/${fact.id}`);
      batch.set(factRef, fact);
    }
    await batch.commit();

    // Update provider run status
    await db.doc(`raceProviderRuns/${providerRunId}`).update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      factsGenerated: raceFacts.length,
    });

    logger.info('Race data ingested successfully', { eventId, sessionKey, factsCount: raceFacts.length });
  } catch (error) {
    logger.error('Ingestion failed', { eventId, sessionKey, error });
    
    await db.doc(`raceProviderRuns/${providerRunId}`).update({
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    throw error;
  }
}

/**
 * Normalizes raw provider data into canonical race facts
 */
function normalizeRaceFacts(
  eventId: string,
  sessionKey: number,
  laps: OpenF1Lap[],
  pitStops: OpenF1PitStop[],
  positions: OpenF1Position[]
): RaceFact[] {
  const facts: RaceFact[] = [];
  const now = admin.firestore.Timestamp.now();

  // FASTEST_LAP
  const validLaps = laps.filter(l => !l.is_pit_out_lap && l.lap_duration > 0);
  if (validLaps.length > 0) {
    const fastest = validLaps.reduce((min, lap) => 
      lap.lap_duration < min.lap_duration ? lap : min
    );
    facts.push({
      id: `fl_${eventId}_${fastest.driver_number}`,
      raceId: eventId,
      metricKey: 'FASTEST_LAP',
      entityType: 'DRIVER',
      entityId: String(fastest.driver_number),
      value: fastest.lap_duration,
      unit: 'seconds',
      sourceProvider: 'openf1',
      sourceRecordId: `lap_${fastest.lap_number}`,
      retrievedAt: now,
      validationStatus: 'VALID',
      confidence: 0.95,
    });
  }

  // FASTEST_PIT_STOP / SLOWEST_PIT_STOP
  const validPitStops = validatePitStops(pitStops, DEFAULT_PIT_STOP_POLICY);
  if (validPitStops.length > 0) {
    const fastest = validPitStops.reduce((min, ps) => 
      ps.pit_duration < min.pit_duration ? ps : min
    );
    const slowest = validPitStops.reduce((max, ps) => 
      ps.pit_duration > max.pit_duration ? ps : max
    );

    facts.push({
      id: `fps_${eventId}_${fastest.driver_number}`,
      raceId: eventId,
      metricKey: 'FASTEST_PIT_STOP',
      entityType: 'DRIVER',
      entityId: String(fastest.driver_number),
      value: fastest.pit_duration,
      unit: 'seconds',
      sourceProvider: 'openf1',
      sourceRecordId: `pit_${fastest.lap_number}`,
      retrievedAt: now,
      validationStatus: 'VALID',
      confidence: 0.9,
    });

    facts.push({
      id: `sps_${eventId}_${slowest.driver_number}`,
      raceId: eventId,
      metricKey: 'SLOWEST_PIT_STOP',
      entityType: 'DRIVER',
      entityId: String(slowest.driver_number),
      value: slowest.pit_duration,
      unit: 'seconds',
      sourceProvider: 'openf1',
      sourceRecordId: `pit_${slowest.lap_number}`,
      retrievedAt: now,
      validationStatus: 'VALID',
      confidence: 0.9,
    });
  }

  // RACE_WINNER (from final positions)
  const finalPositions = positions.filter(p => p.position === 1);
  if (finalPositions.length > 0) {
    const winner = finalPositions[0];
    facts.push({
      id: `rw_${eventId}_${winner.driver_number}`,
      raceId: eventId,
      metricKey: 'RACE_WINNER',
      entityType: 'DRIVER',
      entityId: String(winner.driver_number),
      value: 1,
      unit: 'position',
      sourceProvider: 'openf1',
      sourceRecordId: `pos_${winner.driver_number}`,
      retrievedAt: now,
      validationStatus: 'VALID',
      confidence: 0.99,
    });
  }

  return facts;
}

/**
 * Validates pit stops against policy
 */
function validatePitStops(
  pitStops: OpenF1PitStop[],
  policy: PitStopValidationPolicy
): OpenF1PitStop[] {
  return pitStops.filter(ps => {
    if (ps.pit_duration <= 0) return false;
    if (policy.minimumValidDuration && ps.pit_duration < policy.minimumValidDuration) return false;
    if (policy.maximumValidDuration && ps.pit_duration > policy.maximumValidDuration) return false;
    // Additional validation would go here (penalty-related, incomplete, etc.)
    return true;
  });
}

/**
 * Mock OpenF1 API calls - replace with actual implementation
 */
async function fetchLaps(sessionKey: number): Promise<OpenF1Lap[]> {
  // TODO: Implement actual OpenF1 API call
  // const response = await fetch(`https://api.openf1.org/v1/laps?session_key=${sessionKey}`);
  // return response.json();
  return [];
}

async function fetchPitStops(sessionKey: number): Promise<OpenF1PitStop[]> {
  // TODO: Implement actual OpenF1 API call
  return [];
}

async function fetchPositions(sessionKey: number): Promise<OpenF1Position[]> {
  // TODO: Implement actual OpenF1 API call
  return [];
}