import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';
import type { BookingEvent } from '../../lib/types';
import { blankForm, eventToForm, formToEvent, validate } from './model';

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
        maxRedemptions: 20,
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
    expect(f.tiers).toEqual([{ id: 'tier-1', label: 'General admission', priceInr: 0 }]);
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
    expect(out.tiers).toEqual(ev.tiers);
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
});
