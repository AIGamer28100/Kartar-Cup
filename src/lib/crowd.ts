import { normalize } from './scoring';
import type { Results, ScorableEntry } from './types';

export interface CrowdPick {
  optionId: string;
  count: number;
  share: number;
}
export interface QuestionCrowd {
  questionId: string;
  total: number;
  picks: CrowdPick[];
  accepted: string[];
  voided: boolean;
  roomRight: number;
  roomRightShare: number;
}
export interface BoldCall {
  uid: string;
  name: string;
  questionId: string;
  optionId: string;
  share: number;
}

const MIN_ROOM_FOR_BOLD = 5;

export function crowdBreakdown(
  entries: ScorableEntry[],
  results: Results,
  questionIds: string[],
): QuestionCrowd[] {
  return questionIds.map((questionId) => {
    const accepted = results[questionId] ?? [];
    const acceptedNorm = accepted.map(normalize);
    const voided = accepted.length === 0;
    const counts = new Map<string, number>();
    let total = 0;
    for (const e of entries) {
      const id = normalize(e.answers[questionId] ?? '');
      if (!id) continue;
      total += 1;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const picks = [...counts.entries()]
      .map(([optionId, count]) => ({ optionId, count, share: total ? count / total : 0 }))
      .sort(
        (a, b) =>
          b.count - a.count || (a.optionId < b.optionId ? -1 : a.optionId > b.optionId ? 1 : 0),
      );
    const roomRight = voided
      ? 0
      : picks.filter((p) => acceptedNorm.includes(p.optionId)).reduce((n, p) => n + p.count, 0);
    return {
      questionId,
      total,
      picks,
      accepted,
      voided,
      roomRight,
      roomRightShare: total ? roomRight / total : 0,
    };
  });
}

export function roomAccuracy(breakdown: QuestionCrowd[]): {
  percent: number;
  answered: number;
  scored: number;
} {
  const answered = breakdown.filter((b) => b.total > 0);
  const scoredQs = answered.filter((b) => !b.voided);
  const mean = scoredQs.length
    ? scoredQs.reduce((s, b) => s + b.roomRightShare, 0) / scoredQs.length
    : 0;
  return {
    percent: Math.min(100, Math.max(0, Math.round(mean * 100))),
    answered: answered.length,
    scored: scoredQs.length,
  };
}

export function boldCalls(
  entries: ScorableEntry[],
  results: Results,
  questionIds: string[],
  maxShare = 0.2,
): BoldCall[] {
  const out: BoldCall[] = [];
  for (const b of crowdBreakdown(entries, results, questionIds)) {
    if (b.voided || b.total < MIN_ROOM_FOR_BOLD) continue;
    const acceptedNorm = b.accepted.map(normalize);
    const shareOf = new Map(b.picks.map((p) => [p.optionId, p.share]));
    for (const e of entries) {
      const id = normalize(e.answers[b.questionId] ?? '');
      const share = shareOf.get(id);
      if (share === undefined || !acceptedNorm.includes(id) || share >= maxShare) continue;
      out.push({ uid: e.uid, name: e.name, questionId: b.questionId, optionId: id, share });
    }
  }
  return out.sort((a, b) => a.share - b.share || (a.uid < b.uid ? -1 : 1));
}
