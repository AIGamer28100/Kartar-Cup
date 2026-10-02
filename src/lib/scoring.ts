import { DEFAULT_QUESTION_IDS, MAX_QUESTION_POINTS } from './types';
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

export function maxScore(questions: { points?: number }[]): number {
  return questions.reduce((n, q) => n + pointsOf(q), 0);
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
): RankedRow[] {
  const scored = entries.map((e) => ({ ...e, ...scoreEntry(e.answers, r, ids, points) }));
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

export function winner(rows: RankedRow[]): RankedRow | null {
  return rows.length ? rows[0] : null;
}
