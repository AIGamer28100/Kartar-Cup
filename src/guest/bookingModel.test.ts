import { describe, expect, it } from 'vitest';
import { canGuestCancel, googleCalendarUrl, icsFile, maxQtyFor, seatsLabel, seatsLeft } from './bookingModel';

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

describe('canGuestCancel', () => {
  const ev = { dateUtc: '2026-10-10T12:00:00Z' };
  const before = Date.parse('2026-10-10T11:59:59Z');
  const after = Date.parse('2026-10-10T12:00:00Z');
  it('allows reserved and paid_mock before the event starts', () => {
    expect(canGuestCancel({ status: 'reserved' }, ev, before)).toBe(true);
    expect(canGuestCancel({ status: 'paid_mock' }, ev, before)).toBe(true);
  });
  it('blocks once the event has started', () => {
    expect(canGuestCancel({ status: 'paid_mock' }, ev, after)).toBe(false);
  });
  it('blocks checked_in and cancelled', () => {
    expect(canGuestCancel({ status: 'checked_in' }, ev, before)).toBe(false);
    expect(canGuestCancel({ status: 'cancelled' }, ev, before)).toBe(false);
  });
  it('blocks when the event is unknown or its date is unparseable', () => {
    expect(canGuestCancel({ status: 'reserved' }, null, before)).toBe(false);
    expect(canGuestCancel({ status: 'reserved' }, { dateUtc: 'nope' }, before)).toBe(false);
  });
});
