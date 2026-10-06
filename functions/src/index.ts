import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

admin.initializeApp();

const db = admin.firestore();

// Re-export types for use in other modules
export type { Timestamp } from 'firebase-admin/firestore';

// Import function modules
export { onPredictionLock } from './predictionLock';
export { onRaceDataIngestion } from './raceDataIngestion';
export { onScorePredictions } from './scoring';
export { onCalendarSync } from './calendarSync';
export { onEventOperations } from './eventOperations';
export { scheduledJobs } from './scheduledJobs';