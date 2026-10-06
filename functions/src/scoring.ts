import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';

const db = admin.firestore();

/**
 * Server-Side Prediction Scoring
 * 
 * PRD Requirements:
 * - Scoring must be deterministic, idempotent, server-side, auditable, repeatable
 * - Prediction + Question Version + Canonical Race Facts + Scoring Rule = Score
 * - Re-running scoring must not duplicate points
 * - Each scoring operation has unique run/reference ID
 * - Precomputed leaderboard aggregates
 */

interface ScoringInput {
  competitionId: string;
  raceFacts: RaceFact[];
  questionVersions: QuestionVersion[];
  runId?: string; // For idempotency
}

interface RaceFact {
  id: string;
  raceId: string;
  metricKey: string;
  entityType: string;
  entityId: string;
  value: number | string;
  validationStatus: string;
}

interface QuestionVersion {
  id: string;
  questionId: string;
  type: string;
  title: string;
  options?: Array<{ id: string; label: string }>;
  points: number;
  scoringRule: string;
  lockBehavior: string;
}

interface PredictionSubmission {
  id: string;
  competitionId: string;
  userId: string;
  questionVersionSetId?: string;
  answers: Record<string, string>;
  submittedAt: admin.firestore.Timestamp;
  state: 'ACTIVE' | 'LOCKED' | 'SCORED' | 'VOIDED';
}

interface ScoringResult {
  submissionId: string;
  userId: string;
  score: number;
  details: Array<{
    questionId: string;
    questionVersionId: string;
    userAnswer: string;
    correctAnswers: string[];
    points: number;
    earned: boolean;
  }>;
  scoredAt: admin.firestore.Timestamp;
  runId: string;
}

/**
 * Main scoring function - callable by admins/hosts
 */
export const onScorePredictions = onCall<ScoringInput>(
  { region: 'asia-south1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    // Check admin/host permissions
    const userSnap = await db.doc(`users/${request.auth.uid}`).get();
    const userData = userSnap.data();
    const isAdmin = userData?.roles?.includes('admin') ?? false;
    const isHost = userData?.roles?.includes('host') ?? false;

    if (!isAdmin && !isHost) {
      throw new HttpsError('permission-denied', 'Only admins/hosts can trigger scoring');
    }

    const { competitionId, raceFacts, questionVersions, runId } = request.data;
    const scoringRunId = runId || `scoring_${competitionId}_${Date.now()}`;

    try {
      // Check idempotency - has this run already completed?
      const existingRun = await db.doc(`scoringRuns/${scoringRunId}`).get();
      if (existingRun.exists) {
        const runData = existingRun.data();
        if (runData?.status === 'completed') {
          logger.info('Scoring run already completed', { scoringRunId });
          return { success: true, runId: scoringRunId, alreadyCompleted: true };
        }
      }

      // Create scoring run record
      await db.doc(`scoringRuns/${scoringRunId}`).set({
        competitionId,
        status: 'running',
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        triggeredBy: request.auth.uid,
        raceFactsCount: raceFacts.length,
        questionVersionsCount: questionVersions.length,
      });

      // Get all locked submissions for this competition
      const submissionsSnap = await db
        .collection(`predictionCompetitions/${competitionId}/submissions`)
        .where('state', '==', 'LOCKED')
        .get();

      const submissions: PredictionSubmission[] = submissionsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as PredictionSubmission[];

      logger.info(`Scoring ${submissions.length} submissions`, { competitionId, scoringRunId });

      // Score each submission
      const results: ScoringResult[] = [];
      const batch = db.batch();

      for (const submission of submissions) {
        const result = scoreSubmission(submission, raceFacts, questionVersions, scoringRunId);
        results.push(result);

        // Update submission with score
        const submissionRef = db.doc(`predictionCompetitions/${competitionId}/submissions/${submission.id}`);
        batch.update(submissionRef, {
          state: 'SCORED',
          score: result.score,
          scoredAt: result.scoredAt,
          scoringRunId,
          scoringDetails: result.details,
        });

        // Update user's prediction score aggregate
        const userScoreRef = db.doc(`predictionLeaderboards/${competitionId}/users/${submission.userId}`);
        batch.set(userScoreRef, {
          userId: submission.userId,
          totalScore: admin.firestore.FieldValue.increment(result.score),
          competitionsPlayed: admin.firestore.FieldValue.increment(1),
          lastScoredAt: result.scoredAt,
        }, { merge: true });
      }

      // Update competition status
      const compRef = db.doc(`predictionCompetitions/${competitionId}`);
      batch.update(compRef, {
        status: 'scored',
        scoredAt: admin.firestore.FieldValue.serverTimestamp(),
        scoringRunId,
      });

      // Commit all updates
      await batch.commit();

      // Mark scoring run complete
      await db.doc(`scoringRuns/${scoringRunId}`).update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        submissionsScored: results.length,
      });

      logger.info('Scoring completed', { competitionId, scoringRunId, submissionsScored: results.length });

      return {
        success: true,
        runId: scoringRunId,
        submissionsScored: results.length,
      };
    } catch (error) {
      logger.error('Scoring failed', { competitionId, scoringRunId, error });
      
      await db.doc(`scoringRuns/${scoringRunId}`).update({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      throw new HttpsError('internal', 'Scoring failed');
    }
  }
);

/**
 * Scores a single submission against race facts
 */
function scoreSubmission(
  submission: PredictionSubmission,
  raceFacts: RaceFact[],
  questionVersions: QuestionVersion[],
  runId: string
): ScoringResult {
  const details: ScoringResult['details'] = [];
  let totalScore = 0;

  // Build lookup maps
  const factsByMetric = new Map<string, RaceFact[]>();
  for (const fact of raceFacts) {
    if (fact.validationStatus === 'VALID') {
      const existing = factsByMetric.get(fact.metricKey) || [];
      existing.push(fact);
      factsByMetric.set(fact.metricKey, existing);
    }
  }

  const versionsById = new Map(questionVersions.map(v => [v.id, v]));

  // Score each answer
  for (const [questionId, userAnswer] of Object.entries(submission.answers)) {
    const version = versionsById.get(questionId);
    if (!version) continue;

    const correctAnswers = getCorrectAnswers(version, factsByMetric);
    const points = version.points || 1;
    const earned = correctAnswers.includes(normalize(userAnswer));
    
    if (earned) {
      totalScore += points;
    }

    details.push({
      questionId,
      questionVersionId: version.id,
      userAnswer,
      correctAnswers,
      points,
      earned,
    });
  }

  return {
    submissionId: submission.id,
    userId: submission.userId,
    score: totalScore,
    details,
    scoredAt: admin.firestore.Timestamp.now(),
    runId,
  };
}

/**
 * Determines correct answers for a question based on race facts
 */
function getCorrectAnswers(version: QuestionVersion, factsByMetric: Map<string, RaceFact[]>): string[] {
  // Map question types to race fact metric keys
  const metricMap: Record<string, string[]> = {
    'race_winner': ['RACE_WINNER'],
    'fastest_lap': ['FASTEST_LAP'],
    'fastest_pit_stop': ['FASTEST_PIT_STOP'],
    'slowest_pit_stop': ['SLOWEST_PIT_STOP'],
    'top_speed_driver': ['TOP_SPEED'],
    'top_speed_team': ['TOP_SPEED'],
  };

  const metricKeys = metricMap[version.scoringRule] || [version.scoringRule.toUpperCase()];
  const answers: string[] = [];

  for (const metricKey of metricKeys) {
    const facts = factsByMetric.get(metricKey) || [];
    for (const fact of facts) {
      answers.push(fact.entityId);
    }
  }

  return answers;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}