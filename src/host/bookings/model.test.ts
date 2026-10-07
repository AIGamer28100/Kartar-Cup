import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { BookingEvent } from '../../lib/types';
import { fromLocalInput } from '../settings/time';
import { blankForm, eventToForm, formToEvent, raceDefaultDateUtc, upcomingRaceOptions, validate, distributeLeftoverSeats } from './model';

function makeEvent(): BookingEvent {
  return {
    id: 'ev1',
    title: 'Race night',
    venue: { id: 'venue-1', name: 'The Pit', city: 'Bengaluru', mapUrl: 'https://maps.example/x', capacityDefault: 50 },
    dateUtc: '2026-03-08T09:00:00.000Z',
    tiers: [{ id: 'tier-1', label: 'General', priceInr: 500 }],
    discounts: [
      {
        id: 'discount-1',
        code: 'EARLY10',
        label: 'Early bird',
        kind: 'earlybird',
        value: 10,
        minQty: 2,
        validFromUtc: Timestamp.fromMillis(1_700_000_040_000),
        validToUtc: Timestamp.fromMillis(1_700_100_060_000),
        active: true,
      },
    ],
    capacity: 100,
    bookedCount: 3,
    salesOpen: true,
    createdAt: Timestamp.fromMillis(1_699_000_000_000),
    updatedAt: Timestamp.fromMillis(1_699_000_000_000),
  };
}

describe('bookings model', () => {
  it('blankForm starts with one placeholder tier and no discounts', () => {
    const f = blankForm();
    expect(f.tiers).toEqual([{ id: 'tier-1', label: 'General admission', priceInr: 0, capacity: 0, seatsPerTicket: 1 }]);
    expect(f.discounts).toEqual([]);
  });

  it('eventToForm/formToEvent round-trips the core fields', () => {
    const ev = makeEvent();
    const f = eventToForm(ev);
    expect(f.title).toBe('Race night');
    expect(f.capacity).toBe('100');
    expect(f.venueName).toBe('The Pit');
    expect(f.discounts[0].code).toBe('EARLY10');

    const out = formToEvent(f);
    expect(out.title).toBe('Race night');
    expect(out.capacity).toBe(100);
    expect(out.venue.name).toBe('The Pit');
    expect(out.venue.mapUrl).toBe('https://maps.example/x');
    expect(out.tiers).toEqual([
      { id: 'tier-1', label: 'General', priceInr: 500, capacity: 0, seatsPerTicket: 1 }
    ]);
    expect(out.discounts[0].code).toBe('EARLY10');
    expect(out.discounts[0].validFromUtc?.toMillis()).toBe(1_700_000_040_000);
  });

  it('formToEvent omits optional venue/discount fields when blank', () => {
    const f = blankForm();
    f.title = 'Test';
    f.capacity = '10';
    f.dateUtc = '2026-01-01T10:00';
    f.venueName = 'V';
    f.venueCity = 'C';
    const out = formToEvent(f);
    expect(out.venue.mapUrl).toBeUndefined();
    expect(out.venue.capacityDefault).toBeUndefined();
    expect(out.raceId).toBeUndefined();
  });

  it('validate flags required fields and hard limits', () => {
    const f = blankForm();
    const errs = validate(f);
    expect(errs.title).toBeTruthy();
    expect(errs.capacity).toBeTruthy();
    expect(errs.dateUtc).toBeTruthy();
    expect(errs.venueName).toBeTruthy();
    expect(errs.venueCity).toBeTruthy();
  });

  it('validate rejects non-integer or non-positive capacity', () => {
    const f = blankForm();
    f.title = 'T';
    f.dateUtc = '2026-01-01T10:00';
    f.venueName = 'V';
    f.venueCity = 'C';
    f.capacity = '0';
    expect(validate(f).capacity).toBeTruthy();
    f.capacity = '1.5';
    expect(validate(f).capacity).toBeTruthy();
    f.capacity = '5';
    expect(validate(f).capacity).toBeUndefined();
  });

  it('validate enforces tier and discount caps', () => {
    const f = blankForm();
    f.title = 'T';
    f.dateUtc = '2026-01-01T10:00';
    f.venueName = 'V';
    f.venueCity = 'C';
    f.capacity = '5';
    f.tiers = Array.from({ length: 11 }, (_, i) => ({ id: `tier-${i}`, label: 'x', priceInr: 0 }));
    expect(validate(f).tiers).toBeTruthy();
  });

  describe('upcomingRaceOptions', () => {
    it('returns the next scheduled races, skipping cancelled-by-host, soonest first', () => {
      // R15 Azerbaijan is cancelled-by-host; real calendar data, same fixture date used by
      // eventsModel.test.ts's previousRace tests.
      const opts = upcomingRaceOptions(new Date('2026-09-27T00:00:00Z'), 3);
      expect(opts.map((r) => r.round)).toEqual([16, 17, 18]);
    });

    it('keeps the currently-linked race in the list even once it falls outside the window', () => {
      const opts = upcomingRaceOptions(new Date('2026-09-27T00:00:00Z'), 2, '2026-r22-qatar');
      expect(opts[0].id).toBe('2026-r22-qatar');
      expect(opts.length).toBe(3); // the extra, plus the normal 2-item window
    });

    it('does not duplicate the extra race when it is already in the window', () => {
      const opts = upcomingRaceOptions(new Date('2026-09-27T00:00:00Z'), 3, '2026-r16-malaysia');
      expect(opts.filter((r) => r.id === '2026-r16-malaysia')).toHaveLength(1);
    });
  });

  describe('raceDefaultDateUtc', () => {
    it('is 30 minutes before the race start (DEFAULT_RACE_START_UTC_TIME convention)', () => {
      const race = upcomingRaceOptions(new Date('2026-09-27T00:00:00Z'), 1)[0]; // round 16, raceDate 2026-10-04
      const result = raceDefaultDateUtc(race);
      const startMs = Date.parse(`${race.raceDate}T13:00:00Z`);
      expect(fromLocalInput(result)).toBe(startMs - 30 * 60_000);
    });

    it('uses the real lights-out from the schedule when it has the round', () => {
      const race = upcomingRaceOptions(new Date('2026-09-27T00:00:00Z'), 1)[0];
      const real = Date.parse('2026-10-04T07:00:00Z');
      const schedule = new Map([[race.round, [{ key: 'race' as const, label: 'Race', startMs: real }]]]);
      expect(fromLocalInput(raceDefaultDateUtc(race, schedule))).toBe(real - 30 * 60_000);
    });
  });

  describe('distributeLeftoverSeats', () => {
    it('distributes leftover seats to the tier with lowest seatsPerTicket', () => {
      const tiers = [
        { id: 't1', label: 'Single', priceInr: 500, capacity: 10, seatsPerTicket: 1 },
        { id: 't2', label: 'Couple', priceInr: 900, capacity: 5, seatsPerTicket: 2 },
      ];
      const capacity = 25;
      // Booked: 10*1 + 5*2 = 20 seats, leftover = 5
      // Lowest is t1 (1 seat/ticket), so add floor(5/1) = 5 more tickets
      const result = distributeLeftoverSeats(tiers, capacity);
      expect(result[0].capacity).toBe(15);
      expect(result[1].capacity).toBe(5);
    });

    it('handles ties by choosing the first tier', () => {
      const tiers = [
        { id: 't1', label: 'A', priceInr: 500, capacity: 10, seatsPerTicket: 1 },
        { id: 't2', label: 'B', priceInr: 500, capacity: 10, seatsPerTicket: 1 },
      ];
      const result = distributeLeftoverSeats(tiers, 25);
      // Both have 1 seat/ticket, t1 wins the tie (first one)
      expect(result[0].capacity).toBe(15);
      expect(result[1].capacity).toBe(10);
    });

    it('does not mutate the input array', () => {
      const tiers = [
        { id: 't1', label: 'Single', priceInr: 500, capacity: 10, seatsPerTicket: 1 },
      ];
      const original = JSON.stringify(tiers);
      distributeLeftoverSeats(tiers, 15);
      expect(JSON.stringify(tiers)).toBe(original);
    });

    it('leaves capacity unchanged when there is no leftover', () => {
      const tiers = [
        { id: 't1', label: 'Single', priceInr: 500, capacity: 10, seatsPerTicket: 1 },
        { id: 't2', label: 'Couple', priceInr: 900, capacity: 5, seatsPerTicket: 2 },
      ];
      const result = distributeLeftoverSeats(tiers, 20);
      // Exact fit: 10*1 + 5*2 = 20
      expect(result[0].capacity).toBe(10);
      expect(result[1].capacity).toBe(5);
    });

    it('ignores remainder seats (drops them)', () => {
      const tiers = [
        { id: 't1', label: 'Single', priceInr: 500, capacity: 10, seatsPerTicket: 1 },
        { id: 't2', label: 'Couple', priceInr: 900, capacity: 5, seatsPerTicket: 2 },
      ];
      const result = distributeLeftoverSeats(tiers, 26);
      // Booked: 20 seats, leftover = 6
      // Lowest is t1 (1 seat/ticket), add floor(6/1) = 6 tickets (no remainder)
      expect(result[0].capacity).toBe(16);
    });

    it('does not apply when any tier is unlimited (capacity 0 or undefined)', () => {
      const tiers = [
        { id: 't1', label: 'Single', priceInr: 500, capacity: 10, seatsPerTicket: 1 },
        { id: 't2', label: 'Couple', priceInr: 900, capacity: 0, seatsPerTicket: 2 }, // unlimited
      ];
      const result = distributeLeftoverSeats(tiers, 25);
      // Does not apply because t2 has unlimited capacity
      expect(result[0].capacity).toBe(10);
      expect(result[1].capacity).toBe(0);
    });

    it('handles tiers with seatsPerTicket > 1', () => {
      const tiers = [
        { id: 't1', label: 'Four-seater', priceInr: 1800, capacity: 2, seatsPerTicket: 4 },
      ];
      const result = distributeLeftoverSeats(tiers, 10);
      // Booked: 2*4 = 8 seats, leftover = 2
      // Add floor(2/4) = 0 tickets, remainder 2 seats stays unsold
      expect(result[0].capacity).toBe(2);
    });
  });
});
