/** Pure helpers for the booking screens (no firebase imports, so they unit-test in plain node). */
import type { BookingEvent, Discount } from '../lib/types';

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

/** The typed code's lookup, kept out of the page so it is testable and matched in one place only. */
export function findDiscountByCode(discounts: Discount[], code: string): Discount | null {
  const want = code.trim().toLowerCase();
  if (!want) return null;
  return discounts.find((d) => d.code?.toLowerCase() === want) ?? null;
}

/** What to tell the buyer about the code they typed. `applyDiscount` is handed null both when no code
 * was typed and when the typed code matched nothing, so it returns rejectedReason null for both and a
 * wrong code would otherwise get no message at all; only the caller knows which case it is. */
export function discountNotice(code: string, matched: Discount | null, pricingReason: string | null): string | null {
  if (!code.trim()) return null;
  if (!matched) return 'That discount code is not recognised.';
  return pricingReason;
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

/* ---------- refund cutoff (R56) ---------- */

/** Minutes before the event start within which no refund is issued, when the event sets none. */
export const DEFAULT_REFUND_CUTOFF_MIN = 60;
/** A week is the ceiling; 0 means refunds are allowed right up to the start. */
export const MAX_REFUND_CUTOFF_MIN = 10080;

/** True for an integer 0..MAX_REFUND_CUTOFF_MIN. firestore.rules enforce the same bound. */
export function validRefundCutoffMin(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_REFUND_CUTOFF_MIN;
}

/** The cutoff in milliseconds. A missing or out-of-range value falls back to the default. */
export function refundCutoffMsFor(ev: Pick<BookingEvent, 'dateUtc' | 'refundCutoffMin'>): number {
  const min = validRefundCutoffMin(ev.refundCutoffMin) ? ev.refundCutoffMin : DEFAULT_REFUND_CUTOFF_MIN;
  return min * 60_000;
}

/** True when `nowMs` is inside the no-refund window before the event starts. Exactly at the cutoff
 * counts as closed (the rules require now < start - cutoff). An unreadable start date is closed. */
export function refundWindowClosed(ev: Pick<BookingEvent, 'dateUtc' | 'refundCutoffMin'>, nowMs: number): boolean {
  const start = Date.parse(ev.dateUtc);
  if (Number.isNaN(start)) return true;
  return nowMs >= start - refundCutoffMsFor(ev);
}
