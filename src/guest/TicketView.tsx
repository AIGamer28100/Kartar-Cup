import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import QRCode from 'qrcode';
import { QrCode } from '@phosphor-icons/react';
import Skeleton from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { signInGoogle } from '../lib/firebase';
import { watchBooking, watchBookingEvent } from '../lib/bookings';
import type { Booking, BookingEvent } from '../lib/types';
import GoogleCta from './SignIn';

import MyCards from './MyCards';
import TicketActions, { PolicyNote } from './TicketActions';
import { bookingStatusLabel, formatInr } from './profileModel';
import { Eyebrow, PageTitle, Reveal, Shell } from './parts';

/** The scannable ticket: encodes the booking id only (R23, no PII). Shared by the purchase
 * confirmation and the persistent ticket page so both always render the same code. */
export function TicketQr({ bookingId, dim = false }: { bookingId: string; dim?: boolean }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(bookingId, { margin: 1, width: 480, color: { dark: '#111', light: '#fff' } })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {qr ? (
        <img
          src={qr}
          alt="Ticket QR code"
          className={`size-60 rounded-lg border border-line bg-white p-2 ${dim ? 'opacity-40' : ''}`}
        />
      ) : (
        <Skeleton className="size-60 rounded-lg" />
      )}
      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
        <QrCode size={16} weight="regular" aria-hidden="true" />
        <span className="select-all">{bookingId}</span>
      </p>
    </div>
  );
}

const backLink =
  '-mx-2 mt-6 inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent-text underline decoration-line underline-offset-4 transition hover:decoration-accent';

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <Reveal>
        <Eyebrow>Ticket</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>{title}</h1>
        <p className="mt-4 max-w-[38ch] text-muted">{body}</p>
        <Link to="/profile" className={backLink}>
          Back to your bookings
        </Link>
      </Reveal>
    </Shell>
  );
}

/** Persistent ticket page, reachable from Profile any time after purchase. Only the buyer can
 * load it: the booking read rule is buyerUid == auth.uid (or host), so a pasted link to someone
 * else's ticket fails closed (R15) and we show the same "can't find it" notice as a missing one. */
export default function TicketPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { ready, user } = useAuth();
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [event, setEvent] = useState<BookingEvent | null | undefined>(undefined);

  useEffect(() => {
    if (!user || !bookingId) return;
    setBooking(undefined);
    return watchBooking(bookingId, setBooking, () => setBooking(null));
  }, [user, bookingId]);

  const eventId = booking?.bookingEventId;
  useEffect(() => {
    if (!eventId) return;
    return watchBookingEvent(eventId, setEvent, () => setEvent(null));
  }, [eventId]);

  if (!ready) {
    return (
      <Shell>
        <Skeleton className="mt-8 h-10 w-64" />
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <Reveal>
          <Eyebrow>Ticket</Eyebrow>
          <h1 className={`mt-3 ${PageTitle}`}>Sign in to see your ticket</h1>
          <p className="mt-4 max-w-[38ch] text-muted">Tickets are only shown to the person who booked them.</p>
        </Reveal>
        <Reveal index={1} className="mt-6 max-w-sm">
          <GoogleCta onGoogle={async () => void (await signInGoogle())} />
        </Reveal>
      </Shell>
    );
  }

  if (booking === undefined) {
    return (
      <Shell>
        <Skeleton className="mt-8 h-10 w-64" />
        <Skeleton className="mt-6 size-60 rounded-lg" />
      </Shell>
    );
  }

  if (booking === null) {
    return <Notice title="We couldn’t find that ticket" body="It may belong to a different account, or the link is wrong." />;
  }

  const tierLabel = event?.tiers.find((t) => t.id === booking.tierId)?.label ?? booking.tierId;
  const cancelled = booking.status === 'cancelled';
  const unpaid = booking.status === 'reserved';
  const used = booking.status === 'checked_in';

  return (
    <Shell>
      <Reveal>
        <Eyebrow>{bookingStatusLabel(booking.status)}</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>
          {event === undefined ? <Skeleton className="h-10 w-72" /> : (event?.title ?? 'Watch party')}
        </h1>
        <p className="mt-2 text-muted">
          {tierLabel} · Qty {booking.qty} · {formatInr(booking.totalInr)}
        </p>
        {event && (
          <p className="mt-1 text-sm text-muted">
            {event.venue.name}, {event.venue.city}
          </p>
        )}
      </Reveal>
      <Reveal index={1} className="mt-8">
        {cancelled ? (
          <div role="status" className="max-w-xl rounded-lg border-2 border-dashed border-accent px-4 py-5">
            <p className="font-mono text-sm font-semibold uppercase tracking-widest text-accent-text">Cancelled</p>
            <p className="mt-2 text-muted">
              This booking was cancelled and its seats released. This ticket is no longer valid, so there is no code to scan.
            </p>
            {booking.refund === 'mock_refunded' && (
              <p className="mt-2 text-sm text-muted">Your payment has been marked as refunded.</p>
            )}
          </div>
        ) : (
          <>
            <TicketQr bookingId={booking.id} dim={used} />
            {used && <p className="mt-3 text-center text-sm text-muted">Already checked in at the door.</p>}
            {unpaid && <p className="mt-3 text-center text-sm text-muted">Payment is not complete yet.</p>}
          </>
        )}
      </Reveal>
      {!cancelled && !unpaid && (
        <Reveal index={2} className="mt-8">
          <MyCards booking={booking} />
        </Reveal>
      )}
      {event && !cancelled && (
        <Reveal index={2} className="mt-8">
          <TicketActions event={event} bookingId={booking.id} />
        </Reveal>
      )}
      {event?.policy && (
        <Reveal index={3} className="mt-6 max-w-xl">
          <PolicyNote policy={event.policy} />
        </Reveal>
      )}
      <Reveal index={4}>
        <Link to="/profile" className={backLink}>
          Back to your bookings
        </Link>
      </Reveal>
    </Shell>
  );
}
