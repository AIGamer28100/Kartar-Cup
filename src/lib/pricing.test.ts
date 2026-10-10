import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { applyDiscount, partialReleaseTotals } from './pricing';
import type { Discount, PriceTier } from './types';

const T = 1_000_000_000_000; // fixed "now" for validFrom/To window tests

const tier = (over: Partial<PriceTier> = {}): PriceTier => ({
  id: 't1',
  label: 'Single',
  priceInr: 500,
  ...over,
});

const discount = (over: Partial<Discount> = {}): Discount => ({
  id: 'd1',
  label: 'Test',
  kind: 'percent',
  value: 10,
  active: true,
  ...over,
});

describe('applyDiscount', () => {
  it('no discount passes gross through unchanged', () => {
    const r = applyDiscount(tier(), null, 2);
    expect(r).toEqual({ unitPriceInr: 500, discountAmountInr: 0, totalInr: 1000, totalSeats: 2, rejectedReason: null });
  });

  it('unknown tier falls back to zero price, no discount', () => {
    const r = applyDiscount(undefined, discount(), 2);
    expect(r.unitPriceInr).toBe(0);
    expect(r.totalInr).toBe(0);
    expect(r.totalSeats).toBe(2);
    expect(r.rejectedReason).toBe('Unknown price tier.');
  });

  it('percent discount', () => {
    const r = applyDiscount(tier(), discount({ kind: 'percent', value: 10 }), 2);
    expect(r).toEqual({ unitPriceInr: 500, discountAmountInr: 100, totalInr: 900, totalSeats: 2, rejectedReason: null });
  });

  it('flat discount capped at gross total', () => {
    const r1 = applyDiscount(tier(), discount({ kind: 'flat', value: 200 }), 1);
    expect(r1.discountAmountInr).toBe(200);
    expect(r1.totalInr).toBe(300);
    expect(r1.totalSeats).toBe(1);

    const r2 = applyDiscount(tier(), discount({ kind: 'flat', value: 10_000 }), 1);
    expect(r2.discountAmountInr).toBe(500); // capped at gross
    expect(r2.totalInr).toBe(0);
    expect(r2.totalSeats).toBe(1);
  });

  it('group discount requires minQty, otherwise rejected gracefully', () => {
    const ok = applyDiscount(tier(), discount({ kind: 'group', value: 15, minQty: 4 }), 4);
    expect(ok.rejectedReason).toBeNull();
    expect(ok.discountAmountInr).toBe(300); // 15% of 2000
    expect(ok.totalSeats).toBe(4);

    const tooFew = applyDiscount(tier(), discount({ kind: 'group', value: 15, minQty: 4 }), 3);
    expect(tooFew.rejectedReason).toBe('Requires at least 4 tickets.');
    expect(tooFew.discountAmountInr).toBe(0);
    expect(tooFew.totalInr).toBe(1500);
    expect(tooFew.totalSeats).toBe(3);
  });

  it('earlybird within date window applies', () => {
    const d = discount({
      kind: 'earlybird',
      value: 20,
      validFromUtc: Timestamp.fromMillis(T - 1000),
      validToUtc: Timestamp.fromMillis(T + 1000),
    });
    const r = applyDiscount(tier(), d, 1, T);
    expect(r.rejectedReason).toBeNull();
    expect(r.discountAmountInr).toBe(100);
    expect(r.totalSeats).toBe(1);
  });

  it('earlybird before validFromUtc is rejected gracefully', () => {
    const d = discount({ kind: 'earlybird', value: 20, validFromUtc: Timestamp.fromMillis(T + 1000) });
    const r = applyDiscount(tier(), d, 1, T);
    expect(r.rejectedReason).toBe('Discount is not open yet.');
    expect(r.discountAmountInr).toBe(0);
    expect(r.totalSeats).toBe(1);
  });

  it('expired discount (past validToUtc) is rejected gracefully', () => {
    const d = discount({ kind: 'percent', value: 20, validToUtc: Timestamp.fromMillis(T - 1000) });
    const r = applyDiscount(tier(), d, 1, T);
    expect(r.rejectedReason).toBe('Discount has expired.');
    expect(r.discountAmountInr).toBe(0);
    expect(r.totalSeats).toBe(1);
  });

  it('inactive discount is rejected gracefully', () => {
    const r = applyDiscount(tier(), discount({ active: false }), 1);
    expect(r.rejectedReason).toBe('Discount is not active.');
    expect(r.discountAmountInr).toBe(0);
    expect(r.totalInr).toBe(500);
    expect(r.totalSeats).toBe(1);
  });

  it('discount never produces a negative total', () => {
    const r = applyDiscount(tier({ priceInr: 10 }), discount({ kind: 'flat', value: 999999 }), 1);
    expect(r.totalInr).toBe(0);
    expect(r.discountAmountInr).toBe(10);
    expect(r.totalSeats).toBe(1);
  });

  it('bundled tickets: seatsPerTicket > 1 calculates totalSeats correctly', () => {
    const r = applyDiscount(tier({ seatsPerTicket: 2 }), null, 3);
    expect(r.totalSeats).toBe(6);
    expect(r.totalInr).toBe(1500);
  });

  it('tier capacity is not checked in applyDiscount (validated at reservation time)', () => {
    const r = applyDiscount(tier({ capacity: 5 }), null, 10);
    expect(r.totalSeats).toBe(10);
    expect(r.totalInr).toBe(5000);
  });
});

describe('partialReleaseTotals (R55)', () => {
  it('no discount: refunds the released tickets at full price', () => {
    expect(partialReleaseTotals({ qty: 4, unitPriceInr: 500, totalInr: 2000 }, 3)).toEqual({ totalInr: 1500, discountAmountInr: 0, refundInr: 500 });
  });
  it('discounted: pro-rata, rounded so the refund never exceeds its share', () => {
    // 3 x 500 with 10% off = 1350; keeping 2 -> ceil(900) = 900, refund 450
    expect(partialReleaseTotals({ qty: 3, unitPriceInr: 500, totalInr: 1350 }, 2)).toEqual({ totalInr: 900, discountAmountInr: 100, refundInr: 450 });
    // 3 x 100 for 100 total (odd split): keeping 1 -> ceil(33.33) = 34, refund 66 (not 67)
    expect(partialReleaseTotals({ qty: 3, unitPriceInr: 100, totalInr: 100 }, 1)).toEqual({ totalInr: 34, discountAmountInr: 66, refundInr: 66 });
  });
  it('unit price x kept - discount always equals the new total', () => {
    const t = partialReleaseTotals({ qty: 7, unitPriceInr: 333, totalInr: 1999 }, 4);
    expect(333 * 4 - t.discountAmountInr).toBe(t.totalInr);
    expect(t.refundInr).toBe(1999 - t.totalInr);
  });
});
