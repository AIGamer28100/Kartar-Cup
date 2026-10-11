import { useState } from 'react';
import { EventCancelledBanner, TicketQr, ticketQrPayload } from '../../../guest/TicketView';
import TicketActions, { PolicyNote } from '../../../guest/TicketActions';
import { bookingStatusLabel, formatInr } from '../../../guest/profileModel';
import { cardImageSrc, drawRandomPlayCard, nextPassNumber } from '../../../lib/cards';
import type { Booking, BookingStatus } from '../../../lib/types';
import { mockBooking, mockBookingEvent, mockCards, ts } from '../../fixtures';
import type { PanelProps } from '../MockLab';
import { Case, Grid, Json, Pick } from '../parts';

/* TicketPage and MyCards read Firestore (watchBooking, watchVipCards), so they are not mounted; the QR, banner, actions and policy note are. */

type View = 'ok' | 'no-token' | BookingStatus | 'event-cancelled' | 'event-refunded';
const VIEWS: { id: View; label: string }[] = [
  { id: 'ok', label: 'Paid' },
  { id: 'no-token', label: 'Paid, no token yet' },
  { id: 'reserved', label: 'Reserved' },
  { id: 'checked_in', label: 'Checked in' },
  { id: 'cancelled', label: 'Cancelled (void)' },
  { id: 'event-cancelled', label: 'Event cancelled, refund pending' },
  { id: 'event-refunded', label: 'Event cancelled, refunded' },
];

function bookingFor(v: View, nowMs: number): Booking {
  switch (v) {
    case 'no-token':
      return mockBooking({ qrToken: undefined });
    case 'reserved':
    case 'checked_in':
      return mockBooking({ status: v, checkedInAt: v === 'checked_in' ? ts(nowMs) : undefined });
    case 'cancelled':
      return mockBooking({ status: 'cancelled', refund: 'none' });
    case 'event-cancelled':
      return mockBooking({ status: 'paid_mock' });
    case 'event-refunded':
      return mockBooking({ status: 'cancelled', refund: 'mock_refunded', refundedInr: 1198 });
    default:
      return mockBooking();
  }
}

export default function TicketPanel({ nowMs }: PanelProps) {
  const [view, setView] = useState<View>('ok');
  const b = bookingFor(view, nowMs);
  const eventCancelled = view === 'event-cancelled' || view === 'event-refunded';
  const event = mockBookingEvent(eventCancelled ? { cancelled: true, salesOpen: false, cancelReason: 'Venue unavailable on the day.', cancelledAt: ts(nowMs) } : {});
  const qrState = b.status === 'cancelled' ? 'void' : b.status === 'checked_in' ? 'used' : 'valid';
  const cards = mockCards();
  return (
    <Grid>
      <Case title="Ticket" note="TicketQr in each booking state: valid, used (checked in), void (cancelled) and not-ready (no qrToken). The payload is the secret qrToken only, never the booking id (R23)." wide>
        <Pick label="Booking state" value={view} options={VIEWS} onChange={setView} />
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            {eventCancelled && <div className="mb-4"><EventCancelledBanner event={event} booking={b} /></div>}
            <TicketQr bookingId={b.id} qrToken={b.qrToken} state={qrState} issue={view === 'no-token' ? { status: 'issuing', retry: () => {} } : null} />
          </div>
          <dl className="grid h-fit grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted">status</dt><dd>{bookingStatusLabel(b.status)}</dd>
            <dt className="text-muted">qty</dt><dd>{b.qty} × {formatInr(b.unitPriceInr)}</dd>
            <dt className="text-muted">total</dt><dd>{formatInr(b.totalInr)}</dd>
            <dt className="text-muted">refund</dt><dd>{b.refund ?? '-'}</dd>
            <dt className="text-muted">QR payload</dt><dd className="break-all font-mono">{ticketQrPayload(b) ?? 'null (no QR until issued)'}</dd>
          </dl>
        </div>
        <Json label="booking" value={{ ...b, createdAt: undefined, paidAt: undefined }} />
      </Case>
      <Case title="Actions and policy" note="Add-to-calendar and share, then the host's refund wording.">
        <TicketActions event={event} bookingId={b.id} />
        <div className="mt-4 max-w-md"><PolicyNote policy={event.policy ?? ''} /></div>
      </Case>
      <Case title="Own cards" note="What MyCards shows: next pass number, a random Play draw, and the image source helper.">
        <p className="text-xs text-muted">Next pass number: <span className="font-mono text-ink">#{nextPassNumber(event)}</span></p>
        <p className="mt-1 text-xs text-muted">Draw (rand = 0): <span className="text-ink">{drawRandomPlayCard(cards, () => 0)?.driverName ?? 'none'}</span></p>
        <p className="mt-1 text-xs text-muted">cardImageSrc({'{}'}): <span className="font-mono text-ink">{String(cardImageSrc({}))}</span></p>
      </Case>
    </Grid>
  );
}
