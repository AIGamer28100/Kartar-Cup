import type { RaceInfo } from '../config/calendar';
import { nextRace } from '../config/calendar';
import type { BookingEvent } from '../lib/types';

/** Every scheduled race from the current/next race onward, sorted by date. Cancelled-by-host
 * races and past races are excluded. Scoped to ONE season at a time (F1.com's own listing
 * pattern) — pass `season` to pick it, or omit it to default to the next upcoming race's season
 * so the page never dumps every future season into one flat list. */
export function upcomingRaces(now: Date, races: RaceInfo[], season?: 2026 | 2027): RaceInfo[] {
  const first = nextRace(now, races);
  if (!first) return [];
  const targetSeason = season ?? first.season;
  return [...races]
    .filter(
      (r) => r.status === 'scheduled' && r.season === targetSeason && r.raceDate >= first.raceDate,
    )
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate));
}

/** Distinct seasons that still have at least one upcoming race, in order — drives the season
 * selector on the events page. */
export function upcomingSeasons(now: Date, races: RaceInfo[]): (2026 | 2027)[] {
  const first = nextRace(now, races);
  if (!first) return [];
  const seasons = new Set(
    races.filter((r) => r.status === 'scheduled' && r.raceDate >= first.raceDate).map((r) => r.season),
  );
  return [...seasons].sort((a, b) => a - b);
}

export interface MonthGroup {
  label: string;
  races: RaceInfo[];
}

/** Groups an already-sorted race list by calendar month (UTC, matching raceDate's own
 * timezone-free YYYY-MM-DD), formula1.com-style ("October 2026" section headers). */
export function groupByMonth(races: RaceInfo[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const race of races) {
    const d = new Date(`${race.raceDate}T00:00:00Z`);
    const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.races.push(race);
    else groups.push({ label, races: [race] });
  }
  return groups;
}

export interface TicketStatus {
  available: boolean;
  bookingEventId: string | null;
}

/** A race has tickets only if a public, sales-open BookingEvent references its raceId — never
 * invented (R28-adjacent: no ticket info is shown unless a real bookingEvents doc says so). */
export function ticketStatusFor(raceId: string, openBookingEvents: BookingEvent[]): TicketStatus {
  const match = openBookingEvents.find((e) => e.raceId === raceId);
  return match ? { available: true, bookingEventId: match.id } : { available: false, bookingEventId: null };
}
