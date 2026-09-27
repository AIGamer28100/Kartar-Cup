import type { RaceInfo } from '../config/calendar';
import { nextRace } from '../config/calendar';
import type { BookingEvent } from '../lib/types';

/** Every scheduled race from the current/next race onward through the rest of the season,
 * sorted by date. Cancelled-by-host races and past races are excluded (mirrors HomePage's
 * upcoming-teaser filter, just without the .slice(0, 3)). */
export function upcomingRaces(now: Date, races: RaceInfo[]): RaceInfo[] {
  const first = nextRace(now, races);
  if (!first) return [];
  return [...races]
    .filter((r) => r.status === 'scheduled' && r.raceDate >= first.raceDate)
    .sort((a, b) => a.raceDate.localeCompare(b.raceDate));
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
