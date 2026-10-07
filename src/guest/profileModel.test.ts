import { describe, expect, it } from 'vitest';
import { bookingStatusLabel, entryStatusLabel, formatInr, initials, sortOwnEntries } from './profileModel';
import type { OwnEntryRow } from './profileModel';

describe('sortOwnEntries', () => {
  it('orders most recent submission first', () => {
    const rows: OwnEntryRow[] = [
      { eventId: 'a', eventName: 'A', submittedAtMs: 100, score: null },
      { eventId: 'b', eventName: 'B', submittedAtMs: 300, score: 3 },
      { eventId: 'c', eventName: 'C', submittedAtMs: 200, score: null },
    ];
    expect(sortOwnEntries(rows).map((r) => r.eventId)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const rows: OwnEntryRow[] = [
      { eventId: 'a', eventName: 'A', submittedAtMs: 1, score: null },
      { eventId: 'b', eventName: 'B', submittedAtMs: 2, score: null },
    ];
    const copy = [...rows];
    sortOwnEntries(rows);
    expect(rows).toEqual(copy);
  });
});

describe('entryStatusLabel', () => {
  it('shows pending when unscored', () => {
    expect(entryStatusLabel({ eventId: 'a', eventName: 'A', submittedAtMs: 1, score: null })).toBe(
      'Picks locked in — pending results',
    );
  });
  it('shows the score once available', () => {
    expect(entryStatusLabel({ eventId: 'a', eventName: 'A', submittedAtMs: 1, score: 4 })).toBe('Scored 4/5');
    expect(entryStatusLabel({ eventId: 'a', eventName: 'A', submittedAtMs: 1, score: 7, maxScore: 12 })).toBe('Scored 7/12');
  });
});

describe('bookingStatusLabel', () => {
  it('maps every status', () => {
    expect(bookingStatusLabel('reserved')).toBe('Reserved');
    expect(bookingStatusLabel('paid_mock')).toBe('Paid (sample)');
    expect(bookingStatusLabel('checked_in')).toBe('Checked in');
    expect(bookingStatusLabel('cancelled')).toBe('Cancelled');
  });
});

describe('formatInr', () => {
  it('formats whole rupees', () => {
    expect(formatInr(1500)).toBe('₹1,500');
  });
});

describe('initials', () => {
  it('uses first+last initials from a name', () => {
    expect(initials('Hari Kumar', 'x@y.com')).toBe('HK');
  });
  it('falls back to two chars of a single-word name', () => {
    expect(initials('Hari', undefined)).toBe('HA');
  });
  it('falls back to email when name is missing', () => {
    expect(initials(undefined, 'foo@bar.com')).toBe('FO');
  });
  it('falls back to ?? when nothing is available', () => {
    expect(initials(undefined, undefined)).toBe('??');
  });
});
