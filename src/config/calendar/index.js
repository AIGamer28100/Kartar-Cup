import { RACES_2026 } from './2026';
import { RACES_2027 } from './2027';
export { nextRace } from './types';
export const ALL_RACES = [...RACES_2026, ...RACES_2027].sort((a, b) => a.raceDate.localeCompare(b.raceDate));
export const RACES_BY_ID = Object.fromEntries(ALL_RACES.map((r) => [r.id, r]));
export function getRace(id) {
    return RACES_BY_ID[id];
}
