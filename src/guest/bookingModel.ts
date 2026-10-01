/** Pure helpers for the booking screens (no firebase imports, so they unit-test in plain node). */

export const MAX_QTY_PER_BOOKING = 10;
/** How long a watch party is assumed to run when adding it to a calendar (the booking has a start
 * time only). Approximate on purpose; it only sets the calendar block's end. */
export const WATCH_PARTY_MINUTES = 180;

/** Real remaining seats from the event's own counters (bookedCount is bumped atomically by the
 * reservation transaction), never an estimate. */
export function seatsLeft(ev: { capacity: number; bookedCount: number }): number {
  return Math.max(0, ev.capacity - ev.bookedCount);
}

export function maxQtyFor(left: number): number {
  return Math.max(1, Math.min(MAX_QTY_PER_BOOKING, left));
}

/** Factual availability text. Shows the true numbers; no invented urgency. */
export function seatsLabel(ev: { capacity: number; bookedCount: number }): string {
  const left = seatsLeft(ev);
  if (left === 0) return 'Sold out';
  if (left === 1) return '1 seat left';
  return `${left} of ${ev.capacity} seats left`;
}

export interface CalendarInput {
  title: string;
  startMs: number;
  durationMin?: number;
  location?: string;
  details?: string;
}

const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Opens Google Calendar with the event pre-filled (no account linking, just a URL). */
export function googleCalendarUrl(c: CalendarInput): string {
  const end = c.startMs + (c.durationMin ?? WATCH_PARTY_MINUTES) * 60_000;
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: c.title,
    dates: `${utcStamp(c.startMs)}/${utcStamp(end)}`,
  });
  if (c.location) p.set('location', c.location);
  if (c.details) p.set('details', c.details);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** An .ics file body that Apple/Outlook/Google calendars all open. `uid` keeps re-downloads from
 * creating duplicates. */
export function icsFile(c: CalendarInput & { uid: string }): string {
  const end = c.startMs + (c.durationMin ?? WATCH_PARTY_MINUTES) * 60_000;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kartar CUP//Tickets//EN',
    'BEGIN:VEVENT',
    `UID:${c.uid}@kartar-cup`,
    `DTSTAMP:${utcStamp(Date.now())}`,
    `DTSTART:${utcStamp(c.startMs)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${icsEscape(c.title)}`,
    c.location ? `LOCATION:${icsEscape(c.location)}` : '',
    c.details ? `DESCRIPTION:${icsEscape(c.details)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}
