import { QUESTION_IDS } from './types';
import type { Answers, QuestionId, RankedRow, Results, ScorableEntry } from './types';

export function normalize(id: string): string {
  return id.trim().toLowerCase();
}

export function scoreEntry(
  a: Answers,
  r: Results,
): { score: number; ticks: Record<QuestionId, boolean> } {
  const ticks = {} as Record<QuestionId, boolean>;
  let score = 0;
  for (const q of QUESTION_IDS) {
    const accepted = (r[q] ?? []).map(normalize);
    const ok = accepted.length > 0 && accepted.includes(normalize(a[q] ?? ''));
    ticks[q] = ok;
    if (ok) score += 1;
  }
  return { score, ticks };
}

export function rankEntries(
  entries: ScorableEntry[],
  r: Results,
  override?: string | null,
): RankedRow[] {
  const scored = entries.map((e) => ({ ...e, ...scoreEntry(e.answers, r) }));
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
