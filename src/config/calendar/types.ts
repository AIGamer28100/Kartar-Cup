export interface RaceInfo {
  id: string;
  season: 2026 | 2027;
  round: number;
  name: string;
  shortName: string;
  circuit: string | null;
  locality: string;
  country: string;
  weekendStart: string;
  weekendEnd: string;
  raceDate: string;
  hasSprint: boolean;
  themeId: string;
  status: 'scheduled' | 'cancelled-by-host' | 'in-progress' | 'yellow-flag' | 'red-flag' | 'last-lap' | 'completed';
}

export function nextRace(now: Date, races: RaceInfo[]): RaceInfo | null {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
  return (
    [...races]
      .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
      .find((r) => r.status === 'scheduled' && r.raceDate >= today) ?? null
  );
}
