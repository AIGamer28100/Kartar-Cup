import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REFUND_CUTOFF_MIN, discountNotice, findDiscountByCode, googleCalendarUrl, icsFile, maxQtyFor, refundCutoffMsFor,
  refundWindowClosed, seatsLabel, seatsLeft, validRefundCutoffMin,
} from './bookingModel';

describe('seats', () => {
  it('counts the real remaining seats and never goes negative', () => {
    expect(seatsLeft({ capacity: 50, bookedCount: 12 })).toBe(38);
    expect(seatsLeft({ capacity: 50, bookedCount: 50 })).toBe(0);
    expect(seatsLeft({ capacity: 50, bookedCount: 60 })).toBe(0);
  });

  it('words availability factually', () => {
    expect(seatsLabel({ capacity: 50, bookedCount: 12 })).toBe('38 of 50 seats left');
    expect(seatsLabel({ capacity: 50, bookedCount: 49 })).toBe('1 seat left');
    expect(seatsLabel({ capacity: 50, bookedCount: 50 })).toBe('Sold out');
  });

  it('limits the quantity to what is left, capped at 10, never below 1', () => {
    expect(maxQtyFor(38)).toBe(10);
    expect(maxQtyFor(3)).toBe(3);
    expect(maxQtyFor(0)).toBe(1);
  });
});

describe('calendar', () => {
  const c = {
    title: 'Malaysia GP Watch Party',
    startMs: Date.parse('2026-10-04T06:30:00Z'),
    location: 'ECR Speedway Lounge, Chennai',
    details: 'Doors open 30 min before lights out.',
  };

  it('builds a Google Calendar link with UTC start/end', () => {
    const url = new URL(googleCalendarUrl(c));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('text')).toBe('Malaysia GP Watch Party');
    expect(url.searchParams.get('dates')).toBe('20261004T063000Z/20261004T093000Z');
    expect(url.searchParams.get('location')).toBe('ECR Speedway Lounge, Chennai');
  });

  it('builds a valid .ics with escaped text and CRLF lines', () => {
    const ics = icsFile({ ...c, uid: 'abc123', title: 'Watch, party; night' });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('UID:abc123@kartar-cup');
    expect(ics).toContain('DTSTART:20261004T063000Z');
    expect(ics).toContain('DTEND:20261004T093000Z');
    expect(ics).toContain('SUMMARY:Watch\\, party\\; night');
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
  });

  it('omits empty optional lines', () => {
    const ics = icsFile({ title: 'x', startMs: 0, uid: 'u' });
    expect(ics).not.toContain('LOCATION');
    expect(ics).not.toContain('DESCRIPTION');
  });
});


describe('discount code feedback', () => {
  const percent = { id: 'd1', code: 'RACE10', label: '10% off', kind: 'percent' as const, value: 10, active: true };

  it('finds a discount by code, case-insensitively and trimmed', () => {
    expect(findDiscountByCode([percent], ' race10 ')?.id).toBe('d1');
    expect(findDiscountByCode([percent], 'RACE10')?.id).toBe('d1');
    expect(findDiscountByCode([percent], 'NOPE')).toBeNull();
    expect(findDiscountByCode([percent], '   ')).toBeNull();
    expect(findDiscountByCode([], 'RACE10')).toBeNull();
  });

  it('says a typed code is not recognised when nothing matched', () => {
    // The page looks the code up itself and hands applyDiscount null, which cannot tell "no code
    // typed" from "wrong code" - so the message has to be decided here.
    expect(discountNotice('RACE99', null, null)).toBe('That discount code is not recognised.');
    expect(discountNotice(' race99 ', null, null)).toBe('That discount code is not recognised.');
  });

  it('says nothing when no code was typed', () => {
    expect(discountNotice('', null, null)).toBeNull();
    expect(discountNotice('   ', null, null)).toBeNull();
  });

  it('passes pricing’s own rejection through for a code that exists', () => {
    expect(discountNotice('RACE10', percent, 'Discount has expired.')).toBe('Discount has expired.');
    expect(discountNotice('RACE10', percent, null)).toBeNull();
  });
});

describe('refund cutoff (R56)', () => {
  const START = Date.parse('2026-10-08T12:00:00.000Z');
  const ev = (refundCutoffMin?: number) => ({ dateUtc: '2026-10-08T12:00:00.000Z', ...(refundCutoffMin === undefined ? {} : { refundCutoffMin }) });
  const MIN = 60_000;
  it('defaults to 60 minutes when the field is missing', () => {
    expect(DEFAULT_REFUND_CUTOFF_MIN).toBe(60);
    expect(refundCutoffMsFor(ev())).toBe(60 * MIN);
    expect(refundCutoffMsFor(ev(90))).toBe(90 * MIN);
  });
  it('an out-of-range or non-integer value falls back to the default', () => {
    for (const bad of [-1, 10081, 1.5, NaN]) expect(refundCutoffMsFor(ev(bad))).toBe(60 * MIN);
  });
  it('open one minute before the cutoff, closed exactly at it and one minute after', () => {
    expect(refundWindowClosed(ev(), START - 61 * MIN)).toBe(false);
    expect(refundWindowClosed(ev(), START - 60 * MIN)).toBe(true);
    expect(refundWindowClosed(ev(), START - 59 * MIN)).toBe(true);
  });
  it('a zero cutoff allows refunds right up to the start, not after', () => {
    expect(refundWindowClosed(ev(0), START - 1)).toBe(false);
    expect(refundWindowClosed(ev(0), START)).toBe(true);
  });
  it('an event that already started is closed', () => {
    expect(refundWindowClosed(ev(), START + 5 * MIN)).toBe(true);
    expect(refundWindowClosed(ev(0), START + 5 * MIN)).toBe(true);
  });
  it('honours a custom cutoff, and an unreadable date is closed', () => {
    expect(refundWindowClosed(ev(1440), START - 1439 * MIN)).toBe(true);
    expect(refundWindowClosed(ev(1440), START - 1441 * MIN)).toBe(false);
    expect(refundWindowClosed({ dateUtc: 'soon' }, 0)).toBe(true);
  });
  it('validRefundCutoffMin accepts integers 0..10080 only', () => {
    for (const ok of [0, 1, 60, 10080]) expect(validRefundCutoffMin(ok)).toBe(true);
    for (const bad of [-1, 10081, 1.5, NaN, '60', null, undefined]) expect(validRefundCutoffMin(bad)).toBe(false);
  });
});
