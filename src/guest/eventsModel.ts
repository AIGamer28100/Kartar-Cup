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

export interface TimelineEntry {
  race: RaceInfo;
  /** Days since the previous race in the list; null for the first entry. */
  gapDays: number | null;
  /** True when the gap is more than a week — most F1 rounds run back-to-back or one week apart,
   * so anything longer is a genuine calendar break worth calling out (R33). */
  longBreak: boolean;
  /** Human label for a long break, e.g. "2 week break" / "11 day break"; null otherwise. */
  breakLabel: string | null;
}

/** Turns an already season-scoped, date-sorted race list into timeline entries with the gap
 * before each race — used to render R33's dotted-line calendar (most races are ~1 week apart;
 * a gap over 7 days gets a dashed connector and its own break-length label, never fabricated,
 * computed directly from each race's real raceDate). */
export function timelineEntries(races: RaceInfo[]): TimelineEntry[] {
  const MS_PER_DAY = 86_400_000;
  return races.map((race, i) => {
    if (i === 0) return { race, gapDays: null, longBreak: false, breakLabel: null };
    const prev = races[i - 1];
    const gapDays = Math.round(
      (Date.parse(`${race.raceDate}T00:00:00Z`) - Date.parse(`${prev.raceDate}T00:00:00Z`)) / MS_PER_DAY,
    );
    const longBreak = gapDays > 7;
    const weeks = Math.floor(gapDays / 7);
    const breakLabel = !longBreak
      ? null
      : weeks >= 2
        ? `${weeks} week break`
        : `${gapDays} day break`;
    return { race, gapDays, longBreak, breakLabel };
  });
}

/** The most recent SCHEDULED race before the next one, by date — used for the small "Previous"
 * card ahead of the featured "Next" card. Cancelled-by-host races (e.g. Baku) are skipped, same
 * rule as `upcomingRaces`, since they were never a real watch-party night; returns null when
 * there genuinely isn't one in our data (e.g. right now, before any 2026 round we cover has run). */
export function previousRace(now: Date, races: RaceInfo[]): RaceInfo | null {
  const next = nextRace(now, races);
  if (!next) return null;
  const before = races
    .filter((r) => r.status === 'scheduled' && r.raceDate < next.raceDate)
    .sort((a, b) => b.raceDate.localeCompare(a.raceDate));
  return before[0] ?? null;
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
