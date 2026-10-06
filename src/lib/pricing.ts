import type { Discount, PriceTier } from './types';

/* ---------- pure pricing helper (no firebase import: kept unit-testable in plain node) ---------- */

export interface DiscountResult {
  unitPriceInr: number;
  discountAmountInr: number;
  totalInr: number;
  /** How many seats this quantity consumes (qty * seatsPerTicket). */
  totalSeats: number;
  /** non-null only when the discount could NOT be applied and we fell back to no discount. */
  rejectedReason: string | null;
}

/** Pure: apply a discount to a tier price for a given quantity. Never throws; falls back to
 * "no discount" with a reason string if the discount does not apply (R23 pricing logic). */
export function applyDiscount(
  tier: PriceTier | undefined,
  discount: Discount | null,
  qty: number,
  nowMs: number = Date.now(),
): DiscountResult {
  const unitPriceInr = tier?.priceInr ?? 0;
  const seatsPerTicket = tier?.seatsPerTicket ?? 1;
  const grossInr = unitPriceInr * qty;
  const totalSeats = qty * seatsPerTicket;
  const noDiscount = (reason: string | null): DiscountResult => ({
    unitPriceInr,
    discountAmountInr: 0,
    totalInr: grossInr,
    totalSeats,
    rejectedReason: reason,
  });

  if (!tier) return noDiscount('Unknown price tier.');
  if (!discount) return noDiscount(null);
  if (!discount.active) return noDiscount('Discount is not active.');
  if (discount.minQty !== undefined && qty < discount.minQty) {
    return noDiscount(`Requires at least ${discount.minQty} tickets.`);
  }
  if (discount.validFromUtc && nowMs < discount.validFromUtc.toMillis()) {
    return noDiscount('Discount is not open yet.');
  }
  if (discount.validToUtc && nowMs > discount.validToUtc.toMillis()) {
    return noDiscount('Discount has expired.');
  }
  if (
    discount.maxRedemptions !== undefined &&
    (discount.redeemed ?? 0) >= discount.maxRedemptions
  ) {
    return noDiscount('Discount has been fully redeemed.');
  }

  let discountAmountInr = 0;
  switch (discount.kind) {
    case 'percent':
    case 'earlybird':
      discountAmountInr = Math.round((grossInr * discount.value) / 100);
      break;
    case 'flat':
      discountAmountInr = Math.min(discount.value, grossInr);
      break;
    case 'group':
      discountAmountInr = Math.round((grossInr * discount.value) / 100);
      break;
    default:
      return noDiscount('Unknown discount kind.');
  }
  discountAmountInr = Math.max(0, Math.min(discountAmountInr, grossInr));
  return {
    unitPriceInr,
    discountAmountInr,
    totalInr: grossInr - discountAmountInr,
    totalSeats,
    rejectedReason: null,
  };
}
