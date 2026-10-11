import { vi } from 'vitest';

// Importing the component module pulls in firebase init, which needs real env keys; stub it.
vi.mock('../lib/firebase', () => ({ auth: {}, db: {}, signInGoogle: () => {} }));
import { describe, expect, it } from 'vitest';
import { fmtLocal, getTierMaxQty, getTierRemainingTickets, isTierSoldOut } from './BookingCheckout';
import type { BookingEvent, PriceTier } from '../lib/types';

const ev = (capacity: number, bookedCount: number) => ({ capacity, bookedCount }) as BookingEvent;
const tier = (o: Partial<PriceTier> = {}): PriceTier => ({ id: 't', label: 'T', priceInr: 100, ...o });

describe('getTierRemainingTickets', () => {
  it('unlimited tier (capacity 0/undefined) is limited by event seats only', () => {
    expect(getTierRemainingTickets(ev(50, 20), tier(), {})).toBe(30);
    expect(getTierRemainingTickets(ev(50, 20), tier({ capacity: 0 }), {})).toBe(30);
  });

  it('subtracts tickets already sold in the tier', () => {
    expect(getTierRemainingTickets(ev(50, 0), tier({ capacity: 10 }), { t: 4 })).toBe(6);
  });

  it('is capped by event seats when the tier has more room', () => {
    expect(getTierRemainingTickets(ev(10, 8), tier({ capacity: 100 }), {})).toBe(2);
  });

  it('divides event seats by seatsPerTicket (floored)', () => {
    expect(getTierRemainingTickets(ev(10, 5), tier({ seatsPerTicket: 2 }), {})).toBe(2);
  });

  it('never goes negative when oversold', () => {
    expect(getTierRemainingTickets(ev(50, 0), tier({ capacity: 5 }), { t: 9 })).toBe(0);
    expect(getTierRemainingTickets(ev(10, 15), tier(), {})).toBe(0);
  });
});

describe('isTierSoldOut / getTierMaxQty', () => {
  it('sold out at 0 remaining, but the stepper max still floors at 1', () => {
    const e = ev(10, 10);
    expect(isTierSoldOut(e, tier(), {})).toBe(true);
    expect(getTierMaxQty(e, tier(), {})).toBe(1);
  });

  it('not sold out with 1 left', () => {
    expect(isTierSoldOut(ev(10, 9), tier(), {})).toBe(false);
  });

  it('max qty is capped at 10 per booking', () => {
    expect(getTierMaxQty(ev(500, 0), tier(), {})).toBe(10);
    expect(getTierMaxQty(ev(500, 495), tier(), {})).toBe(5);
  });
});

describe('fmtLocal', () => {
  it('formats weekday, day, month, 24h time', () => {
    const out = fmtLocal(new Date(2026, 2, 8, 9, 5).getTime());
    expect(out).toMatch(/^Sun,? 08 Mar,? 09:05$/);
  });
});
