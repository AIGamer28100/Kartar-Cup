import { describe, expect, it } from 'vitest';
import type { Booking } from '../../lib/types';
import { filterBookings, tally, tierCounts, toCsvRows } from './roster';

const ts = (ms: number) => ({ toMillis: () => ms }) as unknown as Booking['createdAt'];
const b = (id: string, over: Partial<Booking> = {}): Booking => ({
  id, bookingEventId: 'e', buyerUid: 'u', buyerName: 'Asha Rao', buyerEmail: 'asha@x.com', tierId: 't1', qty: 1,
  unitPriceInr: 500, discountAmountInr: 0, totalInr: 500, status: 'reserved', qrToken: id, createdAt: ts(0), ...over,
});
const tiers = [{ id: 't1', label: 'Single', priceInr: 500 }, { id: 't2', label: 'Duo', priceInr: 900 }];
const list = [
  b('a1', { status: 'paid_mock', qty: 2 }),
  b('a2', { status: 'checked_in', buyerName: 'Vik', buyerEmail: 'vik@y.com', tierId: 't2' }),
  b('a3', { status: 'cancelled', qty: 3 }),
  b('a4'),
];

describe('filterBookings', () => {
  it('filters by status', () => {
    expect(filterBookings(list, '', 'cancelled').map((x) => x.id)).toEqual(['a3']);
    expect(filterBookings(list, '', 'all')).toHaveLength(4);
  });
  it('searches name, email and id case-insensitively, combined with status', () => {
    expect(filterBookings(list, 'VIK', 'all').map((x) => x.id)).toEqual(['a2']);
    expect(filterBookings(list, 'y.com', 'all').map((x) => x.id)).toEqual(['a2']);
    expect(filterBookings(list, 'a4', 'all').map((x) => x.id)).toEqual(['a4']);
    expect(filterBookings(list, 'asha', 'paid_mock').map((x) => x.id)).toEqual(['a1']);
  });
});

describe('tally', () => {
  it('counts paid (incl. checked in), checked in, cancelled and seats', () => {
    const t = tally(list, { capacity: 10, bookedCount: 4 });
    expect(t).toMatchObject({ paid: 2, checkedIn: 1, cancelled: 1, reserved: 1, activeSeats: 4, seatsLeft: 6 });
  });
  it('seatsLeft never goes negative', () => {
    expect(tally([], { capacity: 5, bookedCount: 9 }).seatsLeft).toBe(0);
  });
});

describe('tierCounts', () => {
  it('excludes cancelled, keeps zero tiers, appends unknown tiers', () => {
    const c = tierCounts([...list, b('a5', { tierId: 'gone' })], { tiers: [...tiers, { id: 't3', label: 'Group', priceInr: 1 }] });
    expect(c).toEqual([
      { tierId: 't1', label: 'Single', bookings: 2, seats: 3 },
      { tierId: 't2', label: 'Duo', bookings: 1, seats: 1 },
      { tierId: 't3', label: 'Group', bookings: 0, seats: 0 },
      { tierId: 'gone', label: 'gone', bookings: 1, seats: 1 },
    ]);
  });
});

describe('toCsvRows', () => {
  it('maps tier labels and ISO timestamps', () => {
    const [r] = toCsvRows([b('a1', { status: 'paid_mock', paidAt: ts(1_000) })], { tiers });
    expect(r).toMatchObject({ id: 'a1', tier: 'Single', paidAtIso: '1970-01-01T00:00:01.000Z', checkedInAtIso: undefined });
  });
});
