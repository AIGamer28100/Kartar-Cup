import { useState } from 'react';
import { cancelBooking, CancelBookingError } from '../lib/bookings';
import type { Booking, BookingEvent } from '../lib/types';
import { canGuestCancel } from './bookingModel';
import { PolicyNote } from './TicketActions';

const btn =
  'inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-[1rem] font-medium transition duration-150 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Guest self-cancel with an explicit confirm step. Shown only while canGuestCancel holds
 * (own live booking, event not started). Seats are released by the cancelBooking transaction. */
export default function CancelBooking({ booking, event }: { booking: Booking; event: BookingEvent | null | undefined }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!canGuestCancel(booking, event, Date.now())) return null;

  async function run() {
    setBusy(true);
    setError('');
    try {
      await cancelBooking(booking.id, 'guest');
    } catch (e) {
      setError(
        e instanceof CancelBookingError
          ? e.message
          : 'Could not cancel your booking. Check your connection and try again.',
      );
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`${btn} border border-line bg-raised text-ink hover:border-muted`}
      >
        Cancel booking
      </button>
    );
  }

  return (
    <div role="group" aria-label="Confirm cancellation" className="max-w-xl rounded-lg border border-accent px-4 py-4">
      <p className="font-medium text-ink">Cancel this booking?</p>
      <p className="mt-1 text-sm text-muted">Your booking will be cancelled and your seats released. This cannot be undone.</p>
      {event?.policy && (
        <div className="mt-3">
          <PolicyNote policy={event.policy} />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-ink">
          Error: {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className={`${btn} bg-accent text-accent-ink hover:brightness-110`}
        >
          {busy ? 'Cancelling...' : 'Yes, cancel booking'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(false)}
          className={`${btn} border border-line bg-raised text-ink hover:border-muted`}
        >
          Keep booking
        </button>
      </div>
    </div>
  );
}
