import type { RankedRow, ScreenMode } from '../../lib/types';

export interface Podium {
  p1: RankedRow | null;
  p2: RankedRow | null;
  p3: RankedRow | null;
}

/** Reads the top 3 straight off rankEntries' own output (already tie-break/override-aware) —
 * never reimplements ranking. Fewer than 3 entries just leaves those slots null. */
export function buildPodium(rankedRows: RankedRow[]): Podium {
  return {
    p1: rankedRows[0] ?? null,
    p2: rankedRows[1] ?? null,
    p3: rankedRows[2] ?? null,
  };
}

/** Reveal stages: 0 = sealed grid (nobody shown yet), 1 = P3 revealed, 2 = +P2, 3 = +P1 (finale). */
export type Stage = 0 | 1 | 2 | 3;

export function nextStage(current: Stage): Stage {
  return (Math.min(3, current + 1) as Stage);
}

export function prevStage(current: Stage): Stage {
  return (Math.max(0, current - 1) as Stage);
}

export function clampStage(n: number): Stage {
  return (Math.max(0, Math.min(3, Math.round(n))) as Stage);
}

/** Which podium step (if any) a given stage has just made visible; used to decide what should
 * mount its reveal animation vs. render already-settled (and dimmer). */
export function isRevealed(stage: Stage, slot: 'p3' | 'p2' | 'p1'): boolean {
  if (slot === 'p3') return stage >= 1;
  if (slot === 'p2') return stage >= 2;
  return stage >= 3;
}

export const MODE_LABEL: Record<ScreenMode, string> = {
  lobby: 'Lobby',
  standings: 'Standings',
  podium: 'Podium',
};
