/* R41: static facts per 2026 race for the race detail page. Values come from formula1.com race pages and the
 * Wikipedia infobox (turns), cross-checked against each other, researched 2026-10-02; OpenF1 ids were verified
 * the same day. Only ids are matched here - NO runtime name matching (OpenF1 tags the Sepang meeting as
 * "Bahrain Grand Prix"). Lap records are deliberately omitted (unreliable for Malaysia and Abu Dhabi). */

export interface RaceFacts {
  /** OpenF1 meeting and circuit keys. */
  meetingKey: number;
  circuitKey: number;
  lengthKm: number;
  laps: number;
  raceDistanceKm: number;
  turns: number;
  /** Year of the first Grand Prix at this circuit; track age = season - firstGp. */
  firstGp: number;
  /** Circuit coordinates, for the weather forecast. */
  lat: number;
  lon: number;
}

export const RACE_FACTS: Record<string, RaceFacts> = {
  '2026-r15-azerbaijan': { meetingKey: 1295, circuitKey: 144, lengthKm: 6.003, laps: 51, raceDistanceKm: 306.049, turns: 20, firstGp: 2016, lat: 40.3725, lon: 49.8533 },
  '2026-r16-malaysia': { meetingKey: 1308, circuitKey: 12, lengthKm: 5.543, laps: 56, raceDistanceKm: 310.417, turns: 15, firstGp: 1999, lat: 2.76083, lon: 101.738 },
  '2026-r17-singapore': { meetingKey: 1296, circuitKey: 61, lengthKm: 4.927, laps: 62, raceDistanceKm: 305.337, turns: 19, firstGp: 2008, lat: 1.2914, lon: 103.864 },
  '2026-r18-united-states': { meetingKey: 1297, circuitKey: 9, lengthKm: 5.513, laps: 56, raceDistanceKm: 308.405, turns: 20, firstGp: 2012, lat: 30.1328, lon: -97.6411 },
  '2026-r19-mexico': { meetingKey: 1298, circuitKey: 65, lengthKm: 4.304, laps: 71, raceDistanceKm: 305.354, turns: 17, firstGp: 1963, lat: 19.4042, lon: -99.0907 },
  '2026-r20-brazil': { meetingKey: 1299, circuitKey: 14, lengthKm: 4.309, laps: 71, raceDistanceKm: 305.879, turns: 15, firstGp: 1973, lat: -23.7036, lon: -46.6997 },
  '2026-r21-las-vegas': { meetingKey: 1300, circuitKey: 152, lengthKm: 6.201, laps: 50, raceDistanceKm: 309.958, turns: 17, firstGp: 2023, lat: 36.1147, lon: -115.173 },
  '2026-r22-qatar': { meetingKey: 1301, circuitKey: 150, lengthKm: 5.419, laps: 57, raceDistanceKm: 308.611, turns: 16, firstGp: 2021, lat: 25.49, lon: 51.4542 },
  '2026-r23-abu-dhabi': { meetingKey: 1302, circuitKey: 70, lengthKm: 5.281, laps: 58, raceDistanceKm: 306.188, turns: 16, firstGp: 2009, lat: 24.4672, lon: 54.6031 },
};

export const factsFor = (raceId: string): RaceFacts | undefined => RACE_FACTS[raceId];

/** Pirelli nominations: which compound numbers are the Hard / Medium / Soft of that weekend. Hand-maintained
 * (no machine-readable source): add a race when Pirelli announces it; absent = "to be announced". The 2026
 * range is C1-C5. Announced so far (2026-10-02): Baku, Sepang, Singapore. */
export interface TyreNomination {
  hard: string;
  medium: string;
  soft: string;
}
export const TYRES_2026: Record<string, TyreNomination> = {
  '2026-r15-azerbaijan': { hard: 'C3', medium: 'C4', soft: 'C5' },
  '2026-r16-malaysia': { hard: 'C2', medium: 'C3', soft: 'C4' },
  '2026-r17-singapore': { hard: 'C3', medium: 'C4', soft: 'C5' },
};
