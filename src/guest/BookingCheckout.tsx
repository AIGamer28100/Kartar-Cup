import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { TicketIcon } from '@phosphor-icons/react';
import Button from '../components/Button';
import { PageSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { signInGoogle } from '../lib/firebase';
import { applyDiscount, createReservation, markPaidMock, watchBookingEvent, watchTierCounts } from '../lib/bookings';
import { venueEmbedUrl, venueMapLink } from '../lib/mapEmbed';
import type { BookingEvent, PriceTier } from '../lib/types';
import { TicketQr } from './TicketView';
import TicketActions, { PolicyNote } from './TicketActions';
import { maxQtyFor, seatsLabel, seatsLeft } from './bookingModel';
import { formatInr } from './profileModel';
import { usePageMeta } from '../lib/pageMeta';
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

/** Google Maps for the venue: an embedded map plus open/directions links. Uses the host's pasted
 * link when it embeds, else a search for the venue's name and city, so every venue gets a map. */
function VenueMap({ venue }: { venue: BookingEvent['venue'] }) {
  const embed = venueEmbedUrl(venue);
  return (
    <div className="flex flex-col items-center">
      {embed && (
        <a
          href={venueMapLink(venue)}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full max-w-[280px] aspect-square rounded-lg border border-line m-4 overflow-hidden hover:opacity-90 transition"
        >
          <iframe
            src={embed}
            className="w-full h-full pointer-events-none"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Map of ${venue.name}`}
          />
        </a>
      )}
    </div>
  );
}

/** Eyebrow wording per category (R50); legacy docs without a category are F1 watch parties. */
const KIND_LABEL = { f1: 'Watch party', cup: 'Kartar Cup event', club: 'Kartar Club event' } as const;

function ClosedNotice({ event }: { event: BookingEvent | null }) {
  const soon = !!event && event.hosted === true;
  return (
    <Shell>
      <Reveal>
        <Eyebrow>{KIND_LABEL[event?.category ?? 'f1']}</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>{event ? event.title : 'Not taking bookings right now'}</h1>
        <p className="mt-4 max-w-[34ch] text-muted">
          {soon ? 'Booking is opening soon. Check back here or on the events page.' : 'This event isn\u2019t taking bookings right now.'}
        </p>
        <Link
          to="/events"
          className="kerb-link kerb-link--rest mt-6 inline-flex min-h-11 items-center text-sm font-medium text-accent-text"
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
      <Reveal index={2} className="mt-8">
        <TicketActions event={event} bookingId={reservation.bookingId} />
      </Reveal>
      {event.policy && (
        <Reveal index={3} className="mt-6 max-w-xl">
          <PolicyNote policy={event.policy} />
        </Reveal>
      )}
      <Reveal index={4} className="mt-6 flex flex-wrap gap-3">
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

type TierCounts = Record<string, number>;

/** Remaining TICKETS for a tier: its own capacity (0 = unlimited) minus tickets already sold, also
 * limited by the event's remaining seats. Both limits are enforced by firestore.rules. */
function getTierRemainingTickets(event: BookingEvent, tier: PriceTier, counts: TierCounts): number {
  const seatsPerTicket = tier.seatsPerTicket ?? 1;
  const byEvent = Math.floor(seatsLeft(event) / seatsPerTicket);
  if (!tier.capacity || tier.capacity <= 0) return byEvent;
  return Math.min(Math.max(0, tier.capacity - (counts[tier.id] ?? 0)), byEvent);
}

/** Max quantity (number of tickets) for a tier. */
function getTierMaxQty(event: BookingEvent, tier: PriceTier, counts: TierCounts): number {
  return maxQtyFor(getTierRemainingTickets(event, tier, counts));
}

/** Check if a tier is sold out. */
function isTierSoldOut(event: BookingEvent, tier: PriceTier, counts: TierCounts): boolean {
  return getTierMaxQty(event, tier, counts) <= 0;
}

/** Sticky order summary panel for desktop (sidebar). */
function OrderSummary({
  event,
  tier,
  qty,
  discountCode,
  preview,
  onBuy,
  busy,
  user,
  error,
  tierSoldOut,
}: {
  event: BookingEvent;
  tier: PriceTier | undefined;
  qty: number;
  discountCode: string;
  preview: ReturnType<typeof applyDiscount>;
  onBuy: () => void;
  busy: boolean;
  user: { uid: string; displayName?: string | null; email?: string | null } | null;
  error: string;
  tierSoldOut: boolean;
}) {
  const seatsPerTicket = tier?.seatsPerTicket ?? 1;

  return (
    <aside className="hidden lg:block lg:col-span-4 xl:col-span-3">
      <div className="sticky top-24 space-y-6">
        {/* Event quick info */}
        <div className="rounded-lg border border-line bg-raised p-5">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ink truncate">{event.title}</p>
              <p className="mt-1 text-sm text-muted">
                {fmtLocal(new Date(event.dateUtc).getTime())}
              </p>
              <p className="text-sm text-muted">{event.venue.name}, {event.venue.city}</p>
            </div>
          </div>
        </div>

        {/* Order totals */}
        <div className="rounded-lg border border-line bg-raised p-5">
          <h3 className="font-medium text-ink">Order summary</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-muted">
              <span>{tier?.label ?? 'Select tier'} × {qty}</span>
              <span>{formatInr(preview.unitPriceInr * qty)}</span>
            </div>
            {preview.discountAmountInr > 0 && (
              <div className="flex justify-between text-muted">
                <span>Discount {discountCode.trim() ? `(${discountCode.trim().toUpperCase()})` : ''}</span>
                <span className="text-ok">-{formatInr(preview.discountAmountInr)}</span>
              </div>
            )}
            {seatsPerTicket > 1 && (
              <div className="flex justify-between text-muted">
                <span>Seats used</span>
                <span>{qty * seatsPerTicket}</span>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>Booking fee</span>
              <span>None</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold text-ink">
              <span>Total</span>
              <span>{formatInr(preview.totalInr)}</span>
            </div>
          </div>

          {preview.rejectedReason && discountCode.trim() && (
            <p className="mt-3 text-sm text-muted">{preview.rejectedReason}</p>
          )}

          {event.policy && (
            <div className="mt-4">
              <PolicyNote policy={event.policy} />
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-accent-text">
              {error}
            </p>
          )}

          {!user && (
            <p className="mt-3 text-sm text-muted text-center">
              Sign in to complete your booking
            </p>
          )}

          <Button
            onClick={onBuy}
            disabled={busy || !tier || tierSoldOut}
            className="w-full mt-4"
          >
            <TicketIcon size={20} weight="regular" aria-hidden="true" />
            {busy ? 'Reserving...' : !user ? 'Sign in to reserve' : `Reserve & pay ${formatInr(preview.totalInr)}`}
          </Button>
          <p className="mt-3 text-xs text-muted text-center">Payment is a sample for now: nothing is charged.</p>
        </div>

        {/* Map below order summary */}
        <div className="rounded-lg border border-line bg-raised overflow-hidden">
          <VenueMap venue={event.venue} />
        </div>
      </div>
    </aside>
  );
}

/** Main content area with event details and map. */
function EventDetails({
  event,
  tier,
  qty,
  discountCode,
  preview,
  setTierId,
  setQty,
  setDiscountCode,
  tierMaxQty,
  tierSoldOut,
  onBuy,
  busy,
  error,
  eventSoldOut,
  user,
  tierCounts,
}: {
  tierCounts: TierCounts;
  user: { uid: string } | null;
  event: BookingEvent;
  tier: PriceTier | undefined;
  qty: number;
  discountCode: string;
  preview: ReturnType<typeof applyDiscount>;
  setTierId: (id: string) => void;
  setQty: (q: number) => void;
  setDiscountCode: (code: string) => void;
  tierMaxQty: number;
  tierSoldOut: boolean;
  onBuy: () => void;
  busy: boolean;
  error: string;
  eventSoldOut: boolean;
}) {
  const seatsPerTicket = tier?.seatsPerTicket ?? 1;

  return (
    <div className="lg:col-span-8 xl:col-span-9 space-y-6">
      {/* Event header */}
      <div className="space-y-3">
        <Eyebrow>{KIND_LABEL[event.category ?? 'f1']}</Eyebrow>
        <h1 className={PageTitle}>{event.title}</h1>
        <div className="flex flex-wrap items-center gap-3 text-muted text-sm">
          <span>{fmtLocal(new Date(event.dateUtc).getTime())}</span>
          <span>·</span>
          <span>{event.venue.name}</span>
          <span>·</span>
          <span>{event.venue.city}</span>
        </div>
        {event.description && <p className="text-pretty text-muted">{event.description}</p>}
        <p className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest ${eventSoldOut ? 'text-accent-text' : 'text-muted'}`}>
          {seatsLabel(event)}
        </p>
      </div>

      {/* Tier selection */}
      <div className="rounded-lg border border-line bg-raised p-5">
        <h3 className="font-medium text-ink">Select tier</h3>
        <div role="radiogroup" aria-label="Price tier" className="mt-3 space-y-2">
          {event.tiers.filter((t) => !isTierSoldOut(event, t, tierCounts)).length === 0 && (
            <p className="text-sm text-accent-text">All tiers are sold out.</p>
          )}
          {event.tiers.filter((t) => !isTierSoldOut(event, t, tierCounts)).map((t) => {
            const tSoldOut = isTierSoldOut(event, t, tierCounts);
            const tRemaining = getTierRemainingTickets(event, t, tierCounts);
            const tSeatsPerTicket = t.seatsPerTicket ?? 1;
            return (
              <label
                key={t.id}
                className={`flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-3 transition ${tSoldOut
                  ? 'border-line bg-base/50 opacity-50 cursor-not-allowed'
                  : 'border-line bg-base hover:border-muted has-checked:border-accent has-checked:bg-accent/5'
                  }`}
              >
                <span className="flex items-center gap-3 flex-1 min-w-0">
                  <input
                    type="radio"
                    name="tier"
                    value={t.id}
                    checked={tier?.id === t.id}
                    onChange={() => setTierId(t.id)}
                    className="accent-accent"
                    disabled={tSoldOut}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-ink truncate block">{t.label}</span>
                    {tSeatsPerTicket > 1 && (
                      <span className="text-xs text-muted">Ticket for {tSeatsPerTicket} entries</span>
                    )}
                    {!tSoldOut && tRemaining < 100 && (
                      <span className="text-xs text-accent-text">{tRemaining} tickets left</span>
                    )}
                    {tSoldOut && <span className="text-xs text-accent-text">Sold out</span>}
                  </div>
                </span>
                <span className="font-mono text-sm text-muted whitespace-nowrap">{formatInr(t.priceInr)}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-line bg-raised lg:hidden">
        <VenueMap venue={event.venue} />
      </div>

      {/* Qty & Discount */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[140px]">
          <label htmlFor="bc-qty" className="mb-1.5 block text-sm font-medium text-muted">
            Quantity
          </label>
          <input
            id="bc-qty"
            type="number"
            min={1}
            max={tierMaxQty}
            value={qty}
            onChange={(e) => setQty(Math.min(tierMaxQty, Math.max(1, Number(e.target.value) || 1)))}
            className={inputCls}
            disabled={tierSoldOut}
          />
        </div>
        <div className="flex-1 min-w-0">
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
            disabled={tierSoldOut}
          />
        </div>
      </div>

      {/* Order summary (mobile: full width, desktop: hidden - shown in sidebar) */}
      <div className="lg:hidden">
        <div className="rounded-lg border border-line bg-raised p-4">
          <h3 className="font-medium text-ink">Order summary</h3>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between text-muted">
              <span>{tier?.label ?? 'Select tier'} × {qty}</span>
              <span>{formatInr(preview.unitPriceInr * qty)}</span>
            </div>
            {preview.discountAmountInr > 0 && (
              <div className="flex justify-between text-muted">
                <span>Discount {discountCode.trim() ? `(${discountCode.trim().toUpperCase()})` : ''}</span>
                <span className="text-ok">-{formatInr(preview.discountAmountInr)}</span>
              </div>
            )}
            {seatsPerTicket > 1 && (
              <div className="flex justify-between text-muted">
                <span>Seats used</span>
                <span>{qty * seatsPerTicket}</span>
              </div>
            )}
            <div className="flex justify-between text-muted">
              <span>Booking fee</span>
              <span>None</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold text-ink">
              <span>Total</span>
              <span>{formatInr(preview.totalInr)}</span>
            </div>
          </div>

          {preview.rejectedReason && discountCode.trim() && (
            <p className="mt-3 text-sm text-muted">{preview.rejectedReason}</p>
          )}

          {event.policy && (
            <div className="mt-4">
              <PolicyNote policy={event.policy} />
            </div>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-accent-text">{error}</p>
          )}

          {!user && <p className="mt-3 text-center text-sm text-muted">Sign in to complete your booking</p>}
          <Button
            onClick={onBuy}
            disabled={busy || !tier || tierSoldOut}
            className="w-full mt-4"
          >
            <TicketIcon size={20} weight="regular" aria-hidden="true" />
            {busy ? 'Reserving...' : !user ? 'Sign in to reserve' : `Reserve & pay ${formatInr(preview.totalInr)}`}
          </Button>
          <p className="mt-3 text-xs text-muted text-center">Payment is a sample for now: nothing is charged.</p>
        </div>
      </div>
    </div>
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
  usePageMeta({ title: event?.title, description: event ? `${event.title} at ${event.venue.name}, ${event.venue.city} on ${fmtLocal(new Date(event.dateUtc).getTime())}. Book tickets with Kartar CUP.` : undefined });

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

  const [tierCounts, setTierCounts] = useState<TierCounts>({});
  useEffect(() => {
    if (!bookingEventId) return;
    return watchTierCounts(bookingEventId, setTierCounts, () => setTierCounts({}));
  }, [bookingEventId]);

  useEffect(() => {
    const first = event?.tiers.find((t) => !isTierSoldOut(event, t, tierCounts));
    if (event && !tierId && first) setTierId(first.id);
  }, [event, tierId]);

  // Calculate per-tier maxQty and soldOut
  const tier = event?.tiers.find((t) => t.id === tierId);
  const tierMaxQty = tier && event ? getTierMaxQty(event, tier, tierCounts) : 0;
  const tierSoldOut = tier && event ? isTierSoldOut(event, tier, tierCounts) : false;
  const eventSoldOut = event ? seatsLeft(event) <= 0 : false;

  useEffect(() => {
    if (tier) {
      setQty((q) => Math.min(q, tierMaxQty));
    }
  }, [tierMaxQty, tier]);

  const discount = useMemo(
    () =>
      event && discountCode.trim()
        ? (event.discounts.find((d) => d.code?.toLowerCase() === discountCode.trim().toLowerCase()) ?? null)
        : null,
    [event, discountCode],
  );
  const preview = useMemo(() => applyDiscount(tier, discount, qty), [tier, discount, qty]);

  // Auto-reset tier selection if current tier becomes sold out
  useEffect(() => {
    if (tier && event && isTierSoldOut(event, tier, tierCounts)) {
      setTierId('');
      setQty(1);
    }
  }, [event?.bookedCount, tier, tierCounts]);

  // `buyer` is passed right after a popup sign-in, when the `user` from useAuth is still stale.
  const reserve = async (buyer: { uid: string; displayName: string | null; email: string | null } | null = user) => {
    if (!event || !bookingEventId || !buyer || !tier) return;
    setError('');
    setBusy(true);
    try {
      const bookingId = await createReservation({
        bookingEventId,
        buyerUid: buyer.uid,
        buyerName: buyer.displayName ?? buyer.email ?? 'Guest',
        buyerEmail: buyer.email ?? '',
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

  const handleBuy = () => {
    if (user) {
      reserve();
    } else {
      // Popup sign-in, then carry straight on with the reservation (R28: sign in on demand, in place).
      signInGoogle().then((cred) => reserve(cred.user)).catch((e) => {
        setError(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
      });
    }
  };

  if (!bookingEventId || !ready || event === undefined) return <PageSkeleton />;
  if (event === null || !event.salesOpen) return <ClosedNotice event={event} />;
  if (reservation) return <SuccessView event={event} reservation={reservation} />;

  return (
    <Shell>
      <div className="grid grid-cols-12 gap-6">
        {/* Sticky order summary sidebar (desktop only) */}
        <OrderSummary
          event={event}
          tier={tier}
          qty={qty}
          discountCode={discountCode}
          preview={preview}
          onBuy={handleBuy}
          busy={busy}
          user={user}
          error={error}
          tierSoldOut={tierSoldOut}
        />

        {/* Main content */}
        <EventDetails
          event={event}
          tier={tier}
          qty={qty}
          discountCode={discountCode}
          preview={preview}
          setTierId={setTierId}
          setQty={setQty}
          setDiscountCode={setDiscountCode}
          tierMaxQty={tierMaxQty}
          tierSoldOut={tierSoldOut}
          onBuy={handleBuy}
          busy={busy}
          error={error}
          eventSoldOut={eventSoldOut}
          user={user}
          tierCounts={tierCounts}
        />
      </div>
    </Shell>
  );
}