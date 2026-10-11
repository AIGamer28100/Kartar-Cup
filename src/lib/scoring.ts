import { DEFAULT_QUESTION_IDS, MAX_QUESTION_POINTS } from './types';
import { parseCardAnswer } from './cardAnswer';
import type { Answers, RankedRow, Results, ScorableEntry } from './types';

/** Per-question weight by question id; a missing id is worth 1. */
export type PointsMap = Record<string, number>;

/** Anything that is not an integer in 1..MAX_QUESTION_POINTS falls back to 1 (the original scoring). */
export function pointsOf(q: { points?: number }): number {
  const p = q.points;
  return typeof p === 'number' && Number.isInteger(p) && p >= 1 && p <= MAX_QUESTION_POINTS ? p : 1;
}

export function pointsMap(questions: { id: string; points?: number }[]): PointsMap {
  return Object.fromEntries(questions.map((q) => [q.id, pointsOf(q)]));
}

export function maxScore(questions: { points?: number; kind?: string }[]): number {
  return questions.filter((q) => q.kind !== 'card').reduce((n, q) => n + pointsOf(q), 0);
}

export function normalize(id: string): string {
  return id.trim().toLowerCase();
}

export function scoreEntry(
  a: Answers,
  r: Results,
  ids?: string[],
  points?: PointsMap,
): { score: number; ticks: Record<string, boolean> } {
  const ticks: Record<string, boolean> = {};
  let score = 0;
  for (const q of ids ?? [...new Set([...DEFAULT_QUESTION_IDS, ...Object.keys(r)])]) {
    const accepted = (r[q] ?? []).map(normalize);
    const ok = accepted.length > 0 && accepted.includes(normalize(a[q] ?? ''));
    ticks[q] = ok;
    if (ok) score += points?.[q] ?? 1;
  }
  return { score, ticks };
}

export function rankEntries(
  entries: ScorableEntry[],
  r: Results,
  override?: string | null,
  ids?: string[],
  points?: PointsMap,
  /** R46: Play-card points by guest uid, added on top of the quiz points (see cardBonusByUid). */
  bonus?: Record<string, number>,
): RankedRow[] {
  const scored = entries.map((e) => {
    const s = scoreEntry(e.answers, r, ids, points);
    const b = Math.max(0, Math.trunc(bonus?.[e.uid] ?? 0));
    return { ...e, ticks: s.ticks, quizScore: s.score, bonus: b, score: s.score + b };
  });
  scored.sort(
    (x, y) =>
      y.score - x.score ||
      x.submittedAtMs - y.submittedAtMs ||
      (x.uid < y.uid ? -1 : x.uid > y.uid ? 1 : 0),
  );
  if (override && scored.length > 0) {
    const top = scored[0].score;
    const idx = scored.findIndex((e) => e.uid === override);
    if (idx > 0 && scored[idx].score === top) {
      const [row] = scored.splice(idx, 1);
      scored.unshift(row);
    }
  }
  const counts = new Map<number, number>();
  for (const e of scored) counts.set(e.score, (counts.get(e.score) ?? 0) + 1);
  return scored.map((e, i) => ({
    ...e,
    rank: i + 1,
    tiedOnScore: (counts.get(e.score) ?? 0) > 1,
  }));
}

/** R71: each guest's Play-card points, read from their self-reported card-question answer. */
export function cardBonusByUid(
  entries: { uid: string; answers: Answers }[],
  questions: { id: string; kind: string }[],
): Record<string, number> {
  const cardIds = questions.filter((q) => q.kind === 'card').map((q) => q.id);
  const out: Record<string, number> = {};
  for (const e of entries) {
    const n = cardIds.reduce((t, id) => t + (parseCardAnswer(e.answers[id])?.points ?? 0), 0);
    if (n > 0) out[e.uid] = n;
  }
  return out;
}

export function winner(rows: RankedRow[]): RankedRow | null {
  return rows.length ? rows[0] : null;
}
