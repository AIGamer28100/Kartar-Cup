import type { BookingStatus } from '../lib/types';

/** One row of the signed-in guest's own quiz history (R31/R15 — own uid only). Score is null
 * until the host reveals the winner AND publishes results for that event. */
export interface OwnEntryRow {
  eventId: string;
  eventName: string;
  submittedAtMs: number;
  score: number | null;
  /** Count of questions that could be scored (voided questions excluded). Set only with `score`. */
  maxScore?: number;
  /** Chronological position of this event among ALL events (public config), so a skipped event
   * breaks a streak. Absent in legacy rows: entries are then treated as consecutive. */
  eventOrder?: number;
}

export function sortOwnEntries(rows: OwnEntryRow[]): OwnEntryRow[] {
  return [...rows].sort((a, b) => b.submittedAtMs - a.submittedAtMs);
}

export function entryStatusLabel(row: OwnEntryRow): string {
  return row.score === null ? 'Picks locked in — pending results' : `Scored ${row.score}/${row.maxScore ?? 5}`;
}

const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  reserved: 'Reserved',
  paid_mock: 'Paid (sample)',
  checked_in: 'Checked in',
  cancelled: 'Cancelled',
};

export function bookingStatusLabel(status: BookingStatus): string {
  return BOOKING_STATUS_LABEL[status] ?? status;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Two-letter fallback avatar mark from a display name, else the email's first two chars. */
export function initials(name?: string | null, email?: string | null): string {
  const src = (name ?? '').trim();
  if (src) {
    const parts = src.split(/\s+/).filter(Boolean);
    const chars = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [src.slice(0, 2)];
    return chars.join('').toUpperCase().slice(0, 2);
  }
  const e = (email ?? '').trim();
  return e ? e.slice(0, 2).toUpperCase() : '??';
}
