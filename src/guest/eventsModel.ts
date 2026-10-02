import type { RaceInfo } from '../config/calendar';
import { nextRace } from '../config/calendar';
import type { BookingEvent, EventCategory } from '../lib/types';

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

/* ---------- hosted detection + watch-party label (R47/R49) ---------- */

export type TicketState = 'none' | 'soon' | 'open';

export interface TicketStatus {
  /** Tickets can be bought right now. */
  available: boolean;
  bookingEventId: string | null;
  /** 'none' = not hosted: render nothing watch-party related. 'soon' = hosted, sales closed.
   * 'open' = hosted and selling. */
  state: TicketState;
}

/** Legacy docs have no `category`; they were all F1 watch parties. */
export function categoryOf(e: BookingEvent): EventCategory {
  return e.category === 'cup' || e.category === 'club' ? e.category : 'f1';
}

/** The host set this event up (and it is publicly visible): sales open, or explicitly hosted. A
 * legacy sales-open doc without the flag counts as hosted; a closed legacy doc is not listed
 * publicly at all (rules), so it never reaches this page. */
export function isHostedEvent(e: BookingEvent): boolean {
  return e.salesOpen === true || e.hosted === true;
}

/** Source of truth for "is this race hosted": a host-managed, publicly listed BookingEvent whose
 * raceId is the race's id. Sales-open decides 'open' vs 'soon'. Never invented: no doc, no label (R49). */
export function ticketStatusFor(raceId: string, bookingEvents: BookingEvent[]): TicketStatus {
  const matches = bookingEvents.filter((e) => e.raceId === raceId && categoryOf(e) === 'f1' && isHostedEvent(e));
  const open = matches.find((e) => e.salesOpen === true);
  if (open) return { available: true, bookingEventId: open.id, state: 'open' };
  if (matches.length > 0) return { available: false, bookingEventId: matches[0].id, state: 'soon' };
  return { available: false, bookingEventId: null, state: 'none' };
}

/** The next HOSTED race (skips races we are not hosting, e.g. Malaysia), by race date. */
export function nextHostedRace(now: Date, races: RaceInfo[], bookingEvents: BookingEvent[]): RaceInfo | null {
  const today = now.toISOString().slice(0, 10);
  return (
    [...races]
      .filter((r) => r.status === 'scheduled' && r.raceDate >= today)
      .sort((a, b) => a.raceDate.localeCompare(b.raceDate))
      .find((r) => ticketStatusFor(r.id, bookingEvents).state !== 'none') ?? null
  );
}

/* ---------- categories + tabs (R50) ---------- */

export type EventsTab = 'f1' | 'cup' | 'club' | 'all';
export const EVENTS_TABS: { id: EventsTab; label: string }[] = [
  { id: 'f1', label: 'F1' },
  { id: 'cup', label: 'Kartar Cup' },
  { id: 'club', label: 'Kartar Club' },
  { id: 'all', label: 'All' },
];

export function parseTab(raw: string | null | undefined): EventsTab | null {
  return EVENTS_TABS.some((t) => t.id === raw) ? (raw as EventsTab) : null;
}

/** F1 when the calendar has anything to show, else All. A missing/invalid ?tab= falls back to it. */
export function defaultTab(hasUpcomingRaces: boolean): EventsTab {
  return hasUpcomingRaces ? 'f1' : 'all';
}

/** Public, host-created events of one category (publicly listed only), unsorted. */
export function eventsInCategory(events: BookingEvent[], category: EventCategory): BookingEvent[] {
  return events.filter((e) => isHostedEvent(e) && categoryOf(e) === category);
}

/** Events not already represented by a calendar race card: every cup/club event, plus F1 events
 * with no raceId or a raceId that is not on the calendar. */
export function standaloneEvents(events: BookingEvent[], races: RaceInfo[]): BookingEvent[] {
  const raceIds = new Set(races.map((r) => r.id));
  return events.filter(
    (e) => isHostedEvent(e) && !(categoryOf(e) === 'f1' && e.raceId && raceIds.has(e.raceId)),
  );
}

/** How long after its start an event still counts as upcoming (tonight's party is not "past"). */
const GRACE_MS = 6 * 3_600_000;

export function eventStartMs(e: BookingEvent): number {
  const t = Date.parse(e.dateUtc);
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/** The calendar has a date, not a time, per race; 13:00 UTC is the default the page already uses. */
export function raceStartMs(r: RaceInfo): number {
  return Date.parse(`${r.raceDate}T13:00:00Z`);
}

export interface EventsPartition<T> {
  upcoming: T[];
  past: T[];
}

/** Upcoming soonest-first; past most-recent-first. */
export function partitionByTime<T>(items: T[], startMs: (t: T) => number, now: Date): EventsPartition<T> {
  const cut = now.getTime() - GRACE_MS;
  const upcoming = items.filter((i) => startMs(i) >= cut).sort((a, b) => startMs(a) - startMs(b));
  const past = items.filter((i) => startMs(i) < cut).sort((a, b) => startMs(b) - startMs(a));
  return { upcoming, past };
}

export type AllItem =
  | { kind: 'race'; key: string; startMs: number; race: RaceInfo; ticket: TicketStatus }
  | { kind: 'event'; key: string; startMs: number; event: BookingEvent };

/** The "All" tab: every host-created event plus the F1 races that are hosted, in one list. Races
 * the host is not hosting are NOT included (they live on the F1 tab). An F1 event tied to a
 * calendar race appears once, as that race. */
export function allItems(races: RaceInfo[], bookingEvents: BookingEvent[]): AllItem[] {
  const items: AllItem[] = [];
  for (const race of races) {
    if (race.status !== 'scheduled') continue;
    const ticket = ticketStatusFor(race.id, bookingEvents);
    if (ticket.state === 'none') continue;
    items.push({ kind: 'race', key: `race-${race.id}`, startMs: raceStartMs(race), race, ticket });
  }
  for (const event of standaloneEvents(bookingEvents, races)) {
    items.push({ kind: 'event', key: `event-${event.id}`, startMs: eventStartMs(event), event });
  }
  return items;
}
