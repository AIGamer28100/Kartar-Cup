// Source: formula1.com/en/racing/2026 (fetched 2026-09-26).
// Discrepancy: official page titles R16 "Gulf Air Bahrain Grand Prix in Malaysia" (2-4 Oct);
// all other dates R15-R23 match the brief. No sprint weekends shown for R15-R23 -> false.
// R15 Azerbaijan is 'cancelled-by-host' (host will not run a watch party), not an F1 cancellation.
import type { RaceInfo } from './types';

const r = (
  slug: string, round: number, name: string, shortName: string,
  locality: string, country: string, start: string, end: string,
  status: RaceInfo['status'] = 'scheduled',
): RaceInfo => {
  const id = `2026-r${round}-${slug}`;
  return {
    id, season: 2026, round, name, shortName, circuit: null, locality, country,
    weekendStart: start, weekendEnd: end, raceDate: end, hasSprint: false, themeId: id, status,
  };
};

export const RACES_2026: RaceInfo[] = [
  r('azerbaijan', 15, 'Formula 1 Qatar Airways Azerbaijan Grand Prix 2026', 'Azerbaijan', 'Baku', 'Azerbaijan', '2026-09-24', '2026-09-26', 'cancelled-by-host'),
  r('malaysia', 16, 'Formula 1 Gulf Air Bahrain Grand Prix in Malaysia 2026', 'Malaysia', 'Sepang', 'Malaysia', '2026-10-02', '2026-10-04'),
  r('singapore', 17, 'Formula 1 Singapore Airlines Singapore Grand Prix 2026', 'Singapore', 'Singapore', 'Singapore', '2026-10-09', '2026-10-11'),
  r('united-states', 18, 'Formula 1 MSC Cruises United States Grand Prix 2026', 'United States', 'Austin', 'United States', '2026-10-23', '2026-10-25'),
  r('mexico', 19, 'Formula 1 Gran Premio de la Ciudad de Mexico 2026', 'Mexico City', 'Mexico City', 'Mexico', '2026-10-30', '2026-11-01'),
  r('brazil', 20, 'Formula 1 MSC Cruises Grande Premio de Sao Paulo 2026', 'Sao Paulo', 'Sao Paulo', 'Brazil', '2026-11-06', '2026-11-08'),
  r('las-vegas', 21, 'Formula 1 Heineken Las Vegas Grand Prix 2026', 'Las Vegas', 'Las Vegas', 'United States', '2026-11-19', '2026-11-21'),
  r('qatar', 22, 'Formula 1 Qatar Airways Qatar Grand Prix 2026', 'Qatar', 'Lusail', 'Qatar', '2026-11-27', '2026-11-29'),
  r('abu-dhabi', 23, 'Formula 1 Etihad Airways Abu Dhabi Grand Prix 2026', 'Abu Dhabi', 'Abu Dhabi', 'United Arab Emirates', '2026-12-04', '2026-12-06'),
];
