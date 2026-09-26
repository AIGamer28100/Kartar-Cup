import type { RaceInfo } from './types';
import { RACES_2026 } from './2026';
import { RACES_2027 } from './2027';

export type { RaceInfo } from './types';
export { nextRace } from './types';

export const ALL_RACES: RaceInfo[] = [...RACES_2026, ...RACES_2027].sort((a, b) =>
  a.raceDate.localeCompare(b.raceDate),
);

export const RACES_BY_ID: Record<string, RaceInfo> = Object.fromEntries(
  ALL_RACES.map((r) => [r.id, r]),
);

export function getRace(id: string): RaceInfo | undefined {
  return RACES_BY_ID[id];
}
