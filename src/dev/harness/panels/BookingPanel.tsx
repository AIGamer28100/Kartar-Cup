import { useMemo, useState } from 'react';
import { ClosedNotice, EventDetails, OrderSummary, VenueMap, getTierMaxQty, isTierSoldOut } from '../../../guest/BookingCheckout';
import { discountNotice, findDiscountByCode, seatsLabel } from '../../../guest/bookingModel';
import { applyDiscount } from '../../../lib/pricing';
import type { BookingEvent, Discount } from '../../../lib/types';
import { mockBookingEvent, mockTierCounts, ts } from '../../fixtures';
import type { PanelProps } from '../MockLab';
import { Case, Grid, LabButton, Pick } from '../parts';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type ScenarioId = 'normal' | 'sold-out-tier' | 'leftover' | 'closed' | 'cancelled';
const SCENARIOS: { id: ScenarioId; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'sold-out-tier', label: 'One tier sold out' },
  { id: 'leftover', label: 'Few seats left' },
  { id: 'closed', label: 'Sales closed' },
  { id: 'cancelled', label: 'Event cancelled' },
];

function build(s: ScenarioId, nowMs: number): { event: BookingEvent; counts: Record<string, number> } {
  const counts = mockTierCounts();
  switch (s) {
    case 'leftover':
      return { event: mockBookingEvent({ bookedCount: mockBookingEvent().capacity - 3 }), counts };
    case 'closed':
      return { event: mockBookingEvent({ salesOpen: false }), counts };
    case 'cancelled':
      return { event: mockBookingEvent({ cancelled: true, salesOpen: false, cancelReason: 'Venue unavailable on the day.', cancelledAt: ts(nowMs) }), counts };
    default:
      return { event: mockBookingEvent(), counts };
  }
}

function Checkout({ scenario, nowMs }: { scenario: ScenarioId; nowMs: number }) {
  const { event, counts } = build(scenario, nowMs);
  const [tierId, setTierId] = useState(event.tiers[0].id);
  const [qty, setQty] = useState(2);
  const [code, setCode] = useState('');
  const [paid, setPaid] = useState(false);
  const tier = event.tiers.find((t) => t.id === tierId) ?? event.tiers[0];
  const matched = findDiscountByCode(event.discounts, code);
  const preview = applyDiscount(tier, matched, qty, nowMs);
  const tierSoldOut = isTierSoldOut(event, tier, counts);
  const eventSoldOut = event.bookedCount >= event.capacity;
  const props = {
    event, tier, qty, discountCode: code, preview, tierSoldOut, eventSoldOut,
    onBuy: () => setPaid(true), busy: false, error: '', user: { uid: 'mock-user' },
  };
  if (scenario === 'closed' || scenario === 'cancelled') return <ClosedNotice event={event} />;
  return (
    <div className="grid grid-cols-12 gap-6">
      <EventDetails {...props} tierCounts={counts} setTierId={setTierId} setQty={setQty} setDiscountCode={setCode} tierMaxQty={getTierMaxQty(event, tier, counts)} />
      <OrderSummary {...props} />
      <p className="col-span-12 font-mono text-[0.65rem] text-muted">
        {seatsLabel(event)} · {discountNotice(code, matched, preview.rejectedReason) ?? 'no discount notice'} · mock pay {paid ? 'pressed (nothing written)' : 'not pressed'}
      </p>
    </div>
  );
}

function DiscountTable({ nowMs }: { nowMs: number }) {
  const event = mockBookingEvent();
  const byKind = (k: Discount['kind']) => event.discounts.find((d) => d.kind === k) as Discount;
  const percent = byKind('percent');
  const tier = event.tiers[0];
  const rows: { name: string; discount: Discount | null; qty: number; tierId?: string }[] = [
    { name: 'percent', discount: percent, qty: 2 },
    { name: 'flat', discount: byKind('flat'), qty: 2 },
    { name: 'flat larger than gross (capped)', discount: { ...byKind('flat'), value: 500000 }, qty: 1 },
    { name: 'group, qty meets minQty', discount: byKind('group'), qty: byKind('group').minQty ?? 4 },
    { name: 'FAIL wrong code', discount: null, qty: 2 },
    { name: 'FAIL inactive', discount: { ...percent, active: false }, qty: 2 },
    { name: 'FAIL before validFrom', discount: { ...percent, validFromUtc: ts(nowMs + HOUR) }, qty: 2 },
    { name: 'FAIL after validTo', discount: { ...percent, validToUtc: ts(nowMs - HOUR) }, qty: 2 },
    { name: 'FAIL below minQty', discount: byKind('group'), qty: 1 },
    { name: 'FAIL unknown tier', discount: percent, qty: 2, tierId: 'nope' },
  ];
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-b border-line text-left font-mono text-[0.65rem] uppercase tracking-widest text-muted">
          <th className="py-1 pr-2 font-normal">case</th><th className="py-1 pr-2 font-normal">qty</th><th className="py-1 pr-2 font-normal">total</th><th className="py-1 pr-2 font-normal">off</th><th className="py-1 font-normal">rejected</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const res = applyDiscount(r.tierId ? undefined : tier, r.discount, r.qty, nowMs);
          return (
            <tr key={r.name} className="border-b border-line/60">
              <td className="py-1 pr-2 text-ink">{r.name}</td>
              <td className="py-1 pr-2 font-mono text-muted">{r.qty}</td>
              <td className="py-1 pr-2 font-mono text-muted">{res.totalInr}</td>
              <td className="py-1 pr-2 font-mono text-muted">{res.discountAmountInr}</td>
              <td className="py-1 text-muted">{res.rejectedReason ?? '-'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function BookingPanel({ nowMs }: PanelProps) {
  const [scenario, setScenario] = useState<ScenarioId>('normal');
  const [live, setLive] = useState(false);
  const venue = useMemo(() => mockBookingEvent().venue, []);
  return (
    <Grid>
      <Case title="Checkout" note="The real EventDetails and OrderSummary with fixture state. Reserve and mock pay only set a local flag. SuccessView reads Firestore (useAuth, watchBooking) so it is not mounted." wide>
        <Pick label="Scenario" value={scenario} options={SCENARIOS} onChange={setScenario} />
        <div className="mt-4">
          <Checkout key={scenario} scenario={scenario} nowMs={nowMs} />
        </div>
      </Case>
      <Case title="Discounts" note="applyDiscount at the lab clock: every kind, plus each rejection path." wide>
        <DiscountTable nowMs={nowMs} />
        <p className="mt-2 text-xs text-muted">Event date {new Date(nowMs + DAY).toISOString().slice(0, 10)} (lab clock + 1 day) is only used for the earlybird window.</p>
      </Case>
      <Case title="VenueMap" note="Loads a google.com iframe, which is real network, so it is off until switched on.">
        <LabButton pressed={live} onClick={() => setLive((v) => !v)}>load Google iframe (network)</LabButton>
        <div className="mt-3 overflow-hidden rounded-md border border-line">
          {live ? <VenueMap venue={venue} /> : <p className="p-4 text-xs text-muted">VenueMap not mounted.</p>}
        </div>
      </Case>
    </Grid>
  );
}
