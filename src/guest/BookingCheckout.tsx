import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { TicketIcon } from '@phosphor-icons/react';
import Button from '../components/Button';
import Divider from '../components/Divider';
import { PageSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { signInGoogle } from '../lib/firebase';
import { applyDiscount, createReservation, markPaidMock, watchBookingEvent } from '../lib/bookings';
import { toMapEmbedUrl } from '../lib/mapEmbed';
import type { BookingEvent } from '../lib/types';
import GoogleCta from './SignIn';
import { TicketQr } from './TicketView';
import { formatInr } from './profileModel';
import { Eyebrow, PageTitle, Reveal, Shell } from './parts';

/** Guest-side date formatter, kept local rather than importing from src/host/** (host code is
 * lazy-loaded separately precisely so guests never download it, per HostApp.tsx). */
function fmtLocal(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

const inputCls =
  'min-h-12 w-full rounded-lg border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-muted focus:border-accent';

function VenueMap({ mapUrl }: { mapUrl?: string }) {
  if (!mapUrl) return null;
  const embed = toMapEmbedUrl(mapUrl);
  if (embed) {
    return (
      <iframe
        src={embed}
        className="w-full aspect-video rounded-lg border border-line"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        title="Venue map"
      />
    );
  }
  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="-mx-2 inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent underline decoration-line underline-offset-4 transition hover:decoration-accent"
    >
      Open in Google Maps
    </a>
  );
}

function ClosedNotice() {
  return (
    <Shell>
      <Reveal>
        <Eyebrow>Watch party</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>Not taking bookings right now</h1>
        <p className="mt-4 max-w-[34ch] text-muted">This watch party isn&rsquo;t taking bookings right now.</p>
        <Link
          to="/events"
          className="-mx-2 mt-6 inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent underline decoration-line underline-offset-4 transition hover:decoration-accent"
        >
          Back to events
        </Link>
      </Reveal>
    </Shell>
  );
}

interface Reservation {
  bookingId: string;
  tierLabel: string;
  qty: number;
  totalInr: number;
}

function SuccessView({ event, reservation }: { event: BookingEvent; reservation: Reservation }) {
  return (
    <Shell>
      <Reveal>
        <Eyebrow>Ticket confirmed</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>{event.title}</h1>
        <p className="mt-2 text-muted">
          {reservation.tierLabel} · Qty {reservation.qty} · {formatInr(reservation.totalInr)}
        </p>
      </Reveal>
      <Reveal index={1} className="mt-8">
        <TicketQr bookingId={reservation.bookingId} />
      </Reveal>
      <Reveal index={2} className="mt-8 flex flex-wrap gap-3">
        <Link
          to={`/tickets/${reservation.bookingId}`}
          className="inline-flex min-h-12 items-center rounded-lg border border-line bg-raised px-5 text-[1rem] font-medium text-ink transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98]"
        >
          Open ticket page
        </Link>
        <Link
          to="/profile"
          className="inline-flex min-h-12 items-center rounded-lg px-4 text-[1rem] font-medium text-muted transition hover:text-ink"
        >
          Your bookings
        </Link>
      </Reveal>
    </Shell>
  );
}

/** Guest purchase flow for a single booking event: pick tier + qty, preview a live discount
 * price via the pure `applyDiscount`, sign in only when actually reserving (R28: contextual
 * gate, not a page-wide one), then reserve + mock-pay (R23: no real payment provider) and show
 * a QR ticket. */
export default function BookingCheckout() {
  const { bookingEventId } = useParams<{ bookingEventId: string }>();
  const { ready, user } = useAuth();
  const [event, setEvent] = useState<BookingEvent | null | undefined>(undefined);

  const [tierId, setTierId] = useState<string>('');
  const [qty, setQty] = useState(1);
  const [discountCode, setDiscountCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState<Reservation | null>(null);

  useEffect(() => {
    if (!bookingEventId) return;
    setEvent(undefined);
    return watchBookingEvent(bookingEventId, setEvent, () => setEvent(null));
  }, [bookingEventId]);

  useEffect(() => {
    if (event && !tierId && event.tiers.length > 0) setTierId(event.tiers[0].id);
  }, [event, tierId]);

  const tier = event?.tiers.find((t) => t.id === tierId);
  const discount = useMemo(
    () =>
      event && discountCode.trim()
        ? (event.discounts.find((d) => d.code?.toLowerCase() === discountCode.trim().toLowerCase()) ?? null)
        : null,
    [event, discountCode],
  );
  const preview = useMemo(() => applyDiscount(tier, discount, qty), [tier, discount, qty]);

  const reserve = async () => {
    if (!event || !bookingEventId || !user || !tier) return;
    setError('');
    setBusy(true);
    try {
      const bookingId = await createReservation({
        bookingEventId,
        buyerUid: user.uid,
        buyerName: user.displayName ?? user.email ?? 'Guest',
        buyerEmail: user.email ?? '',
        tierId: tier.id,
        qty,
        discountCode: discountCode.trim() || undefined,
      });
      await markPaidMock(bookingId);
      setReservation({ bookingId, tierLabel: tier.label, qty, totalInr: preview.totalInr });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete your booking. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!bookingEventId || !ready || event === undefined) return <PageSkeleton />;
  if (event === null || !event.salesOpen) return <ClosedNotice />;
  if (reservation) return <SuccessView event={event} reservation={reservation} />;

  return (
    <Shell>
      <Reveal>
        <Eyebrow>Watch party</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>{event.title}</h1>
        <p className="mt-2 text-muted">
          {fmtLocal(new Date(event.dateUtc).getTime())} · {event.venue.name}, {event.venue.city}
        </p>
      </Reveal>

      {event.venue.mapUrl && (
        <Reveal index={1} className="mt-6">
          <VenueMap mapUrl={event.venue.mapUrl} />
        </Reveal>
      )}

      <Reveal index={2} className="mt-8">
        <h2 className="text-lg font-medium text-ink">Choose a tier</h2>
        <div role="radiogroup" aria-label="Price tier" className="mt-3 flex flex-col gap-2">
          {event.tiers.map((t) => (
            <label
              key={t.id}
              className="flex min-h-12 cursor-pointer items-center justify-between gap-4 rounded-lg border border-line bg-raised px-4 transition hover:border-muted has-checked:border-accent"
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="tier"
                  value={t.id}
                  checked={tierId === t.id}
                  onChange={() => setTierId(t.id)}
                  className="accent-accent"
                />
                {t.label}
              </span>
              <span className="font-mono text-sm text-muted">{formatInr(t.priceInr)}</span>
            </label>
          ))}
        </div>
      </Reveal>

      <Reveal index={3} className="mt-6 flex flex-wrap gap-6">
        <div>
          <label htmlFor="bc-qty" className="mb-1.5 block text-sm font-medium text-muted">
            Quantity
          </label>
          <input
            id="bc-qty"
            type="number"
            min={1}
            max={10}
            value={qty}
            onChange={(e) => setQty(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
            className={`${inputCls} w-28`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="bc-discount" className="mb-1.5 block text-sm font-medium text-muted">
            Discount code <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="bc-discount"
            type="text"
            value={discountCode}
            onChange={(e) => setDiscountCode(e.target.value)}
            placeholder="e.g. EARLYBIRD"
            className={inputCls}
          />
        </div>
      </Reveal>

      <Reveal index={4} className="mt-6">
        <Divider />
        <div className="flex flex-col gap-1 py-4">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>
              {formatInr(preview.unitPriceInr)} × {qty}
            </span>
            <span>{formatInr(preview.unitPriceInr * qty)}</span>
          </div>
          {preview.discountAmountInr > 0 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>Discount</span>
              <span>-{formatInr(preview.discountAmountInr)}</span>
            </div>
          )}
          <div className="mt-1 flex items-center justify-between text-lg font-semibold text-ink">
            <span>Total</span>
            <span>{formatInr(preview.totalInr)}</span>
          </div>
          {preview.rejectedReason && discountCode.trim() && (
            <p className="mt-1 text-sm text-muted">{preview.rejectedReason}</p>
          )}
        </div>
        <Divider />
      </Reveal>

      {error && (
        <p role="alert" className="mt-6 text-sm text-accent">
          {error}
        </p>
      )}

      <Reveal index={5} className="mt-6">
        {!user ? (
          <GoogleCta onGoogle={() => signInGoogle().then(() => undefined)} />
        ) : (
          <Button onClick={() => void reserve()} disabled={busy || !tier} className="w-full md:w-auto">
            <TicketIcon size={20} weight="regular" aria-hidden="true" />
            {busy ? 'Reserving...' : 'Reserve & pay'}
          </Button>
        )}
      </Reveal>
    </Shell>
  );
}
