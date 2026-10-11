import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import BackLink from '../components/BackLink';
import QRCode from 'qrcode';
import { QrCode } from '@phosphor-icons/react';
import Skeleton, { PageSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { signInGoogle } from '../lib/firebase';
import { ensureQrToken, watchBooking, watchBookingEvent } from '../lib/bookings';
import type { Booking, BookingEvent } from '../lib/types';
import GoogleCta from './SignIn';

import MyCards from './MyCards';
import TicketActions, { PolicyNote } from './TicketActions';
import { bookingStatusLabel, formatInr } from './profileModel';
import { Eyebrow, PageTitle, Reveal, Shell } from './parts';

/** What the ticket QR encodes: the booking's secret qrToken (R23: random, no PII, separate from the
 * booking id that appears on public counters). There is NO fallback to the booking id: a ticket with
 * no usable token has no QR (null) until the owner issues one (ensureQrToken). */
export function ticketQrPayload(b: { id: string; qrToken?: string | null }): string | null {
  return b.qrToken && b.qrToken.trim() ? b.qrToken : null;
}

/** Progress of issuing a missing qrToken for a ticket: null when nothing is pending. */
export interface TokenIssue {
  status: 'issuing' | 'error';
  retry: () => void;
}

/** When the viewer owns a live (not cancelled) booking that has no qrToken yet, issue one exactly once
 * (ref-guarded so strict-mode double effects and re-renders cannot fire a second write). The booking
 * watcher delivers the new token; a failure surfaces as `error` with a retry. */
export function useQrTokenIssue(bookingId: string, qrToken: string | null | undefined, enabled: boolean): TokenIssue | null {
  const hasToken = ticketQrPayload({ id: bookingId, qrToken }) !== null;
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState<number | null>(null);
  const started = useRef<string | null>(null);
  const need = enabled && !hasToken;

  useEffect(() => {
    if (!need) return;
    const key = `${bookingId}:${attempt}`;
    if (started.current === key) return;
    started.current = key;
    ensureQrToken(bookingId).catch(() => setFailed(attempt));
  }, [need, bookingId, attempt]);

  const retry = useCallback(() => {
    setFailed(null);
    setAttempt((n) => n + 1);
  }, []);

  if (!need) return null;
  return { status: failed === attempt ? 'error' : 'issuing', retry };
}

/** Shown in place of the QR while the ticket has no token. */
function TicketNotReady({ issue }: { issue?: TokenIssue | null }) {
  return (
    <div role="status" className="flex size-60 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-line px-4 text-center">
      <p className="font-mono text-sm font-semibold uppercase tracking-widest text-ink">Ticket not ready</p>
      {issue?.status === 'issuing' && <p className="text-sm text-muted">Getting your ticket ready...</p>}
      {issue?.status === 'error' && (
        <>
          <p className="text-sm text-muted">We could not prepare your ticket. Check your connection and try again.</p>
          <button
            type="button"
            onClick={issue.retry}
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-raised px-4 text-sm font-medium text-ink hover:border-muted"
          >
            Try again
          </button>
        </>
      )}
      {!issue && <p className="text-sm text-muted">The code appears here once the ticket owner opens it.</p>}
    </div>
  );
}

/** The scannable ticket, shared by the purchase confirmation and the persistent ticket page so both
 * always render the same code. `void` (cancelled ticket) draws a crossed-out placeholder that
 * encodes nothing of the ticket, so a screenshot of a refunded ticket is useless at the door. */
export function TicketQr({
  bookingId,
  qrToken,
  state = 'valid',
  issue,
}: {
  bookingId: string;
  qrToken?: string | null;
  state?: 'valid' | 'used' | 'void';
  issue?: TokenIssue | null;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const payload = state === 'void' ? 'VOID' : ticketQrPayload({ id: bookingId, qrToken });

  useEffect(() => {
    if (payload === null) {
      setQr(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(payload, { margin: 1, width: 480, color: { dark: '#111', light: '#fff' } })
      .then((url) => !cancelled && setQr(url))
      .catch(() => !cancelled && setQr(null));
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const isVoid = state === 'void';
  if (payload === null) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <TicketNotReady issue={issue} />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {qr ? (
        <div className="relative size-60">
          <img
            src={qr}
            alt={isVoid ? 'Void ticket: no code to scan' : 'Ticket QR code'}
            className={`size-60 rounded-lg border border-line bg-white p-2 ${state === 'used' ? 'opacity-40' : ''} ${isVoid ? 'opacity-25 blur-[3px] grayscale' : ''}`}
          />
          {isVoid && (
            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-lg">
              <span className="absolute h-1 w-[140%] rotate-45 bg-accent" />
              <span className="absolute h-1 w-[140%] -rotate-45 bg-accent" />
              <span className="relative rounded-md border-2 border-accent bg-base px-4 py-1.5 font-mono text-lg font-semibold uppercase tracking-[0.3em] text-accent-text">
                Void
              </span>
            </div>
          )}
        </div>
      ) : (
        <Skeleton variant="shimmer" className="size-60 rounded-lg" />
      )}
      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted">
        <QrCode size={16} weight="regular" aria-hidden="true" />
        <span className={`select-all ${isVoid ? 'line-through' : ''}`}>{bookingId}</span>
      </p>
    </div>
  );
}

/** Banner for a ticket whose event the host cancelled: shown at the top of the ticket page. */
export function EventCancelledBanner({ event, booking }: { event: BookingEvent; booking: Pick<Booking, 'status' | 'refund'> }) {
  const refunded = booking.status === 'cancelled' && booking.refund === 'mock_refunded';
  return (
    <div role="alert" className="relative max-w-xl overflow-hidden rounded-lg border border-accent bg-accent/10 px-4 py-4 sm:px-5">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ backgroundImage: 'var(--kerb-stripes)' }} />
      <p className="font-mono text-xs font-semibold uppercase tracking-widest text-accent-text">Event cancelled</p>
      <p className="mt-1.5 text-lg font-semibold text-ink">This event was cancelled</p>
      {event.cancelReason?.trim() && <p className="mt-1 text-muted">{event.cancelReason.trim()}</p>}
      <p className="mt-3 text-sm font-medium text-ink">{refunded ? 'Your ticket has been refunded.' : 'Your refund is being processed.'}</p>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <Reveal>
        <Eyebrow>Ticket</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>{title}</h1>
        <p className="mt-4 max-w-[38ch] text-muted">{body}</p>
        <BackLink to="/profile" className="mt-6">Back to your bookings</BackLink>
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

  const isOwner = !!user && !!booking && booking.buyerUid === user.uid;
  const issue = useQrTokenIssue(
    bookingId ?? '',
    booking?.qrToken,
    isOwner && !!booking && booking.status !== 'cancelled' && event?.cancelled !== true,
  );

  if (!ready) return <PageSkeleton />;

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
        <Skeleton variant="shimmer" className="mt-8 h-10 w-64" />
        <Skeleton variant="shimmer" className="mt-6 size-60 rounded-lg" />
      </Shell>
    );
  }

  if (booking === null) {
    return <Notice title="We couldn’t find that ticket" body="It may belong to a different account, or the link is wrong." />;
  }

  const tierLabel = event?.tiers.find((t) => t.id === booking.tierId)?.label ?? booking.tierId;
  const cancelled = booking.status === 'cancelled';
  const eventCancelled = event?.cancelled === true;
  const unpaid = booking.status === 'reserved';
  const used = booking.status === 'checked_in';

  return (
    <Shell>
      <Reveal>
        <Eyebrow>{bookingStatusLabel(booking.status)}</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>
          {event === undefined ? <Skeleton variant="shimmer" className="h-10 w-72" /> : (event?.title ?? 'Watch party')}
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
      {event && eventCancelled && (
        <Reveal index={1} className="mt-6">
          <EventCancelledBanner event={event} booking={booking} />
        </Reveal>
      )}
      <Reveal index={1} className="mt-8">
        {cancelled || eventCancelled ? (
          <div className="flex flex-col gap-5">
            <TicketQr bookingId={booking.id} state="void" />
            {!eventCancelled && (
              <div role="status" className="max-w-xl rounded-lg border-2 border-dashed border-accent px-4 py-5">
                <p className="font-mono text-sm font-semibold uppercase tracking-widest text-accent-text">Cancelled</p>
                <p className="mt-2 text-muted">
                  This booking was cancelled and its seats released. This ticket is no longer valid, so there is no code to scan.
                </p>
                {booking.refund === 'mock_refunded' && (
                  <p className="mt-2 text-sm text-muted">Your ticket has been refunded.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <TicketQr bookingId={booking.id} qrToken={booking.qrToken} state={used ? 'used' : 'valid'} issue={issue} />
            {used && <p className="mt-3 text-center text-sm text-muted">Already checked in at the door.</p>}
            {unpaid && <p className="mt-3 text-center text-sm text-muted">Payment is not complete yet.</p>}
          </>
        )}
      </Reveal>
      {!cancelled && !eventCancelled && !unpaid && (
        <Reveal index={2} className="mt-8">
          <MyCards booking={booking} />
        </Reveal>
      )}
      {event && !cancelled && !eventCancelled && (
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
        <BackLink to="/profile" className="mt-6">Back to your bookings</BackLink>
      </Reveal>
    </Shell>
  );
}
