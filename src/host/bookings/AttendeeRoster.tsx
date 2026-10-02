import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, DownloadSimple } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import { cancelBooking, watchAllBookings } from '../../lib/bookings';
import { bookingsToCsv } from '../../lib/csv';
import type { Booking, BookingEvent } from '../../lib/types';
import { bookingStatusLabel, formatInr } from '../../guest/profileModel';
import { inputCls } from '../settings/ui';
import {
  STATUS_FILTERS,
  filterBookings,
  tally,
  tierCounts,
  tierLabelOf,
  toCsvRows,
  type StatusFilter,
} from './roster';

const num = 'font-mono tabular-nums';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2">
      <p className="font-mono text-xs uppercase tracking-widest text-muted">{label}</p>
      <p className={`${num} mt-1 text-2xl font-semibold`}>{value}</p>
    </div>
  );
}

/** Host attendee roster for one booking event: live bookings, search + status filter, tallies,
 * per-row host cancel (confirmed) and CSV export. Host-only (rules gate the bookings query). */
export default function AttendeeRoster({ event, onBack }: { event: BookingEvent; onBack: () => void }) {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    setBookings(null);
    setLoadError('');
    return watchAllBookings(
      event.id,
      (b) => setBookings([...b].sort((x, y) => (y.createdAt?.toMillis?.() ?? 0) - (x.createdAt?.toMillis?.() ?? 0))),
      (e) => setLoadError(e.message || 'Could not load bookings.'),
    );
  }, [event.id]);

  const shown = useMemo(() => (bookings ? filterBookings(bookings, query, status) : []), [bookings, query, status]);
  const totals = useMemo(() => (bookings ? tally(bookings, event) : null), [bookings, event]);
  const tiers = useMemo(() => (bookings ? tierCounts(bookings, event) : []), [bookings, event]);

  async function doCancel(id: string) {
    setBusyId(id);
    setActionError('');
    try {
      await cancelBooking(id, 'host');
      setConfirmId(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not cancel the booking.');
    } finally {
      setBusyId(null);
    }
  }

  function exportCsv() {
    if (!bookings) return;
    const url = URL.createObjectURL(
      new Blob([bookingsToCsv(toCsvRows(bookings, event))], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-bookings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink">
        <ArrowLeft size={20} weight="regular" aria-hidden="true" /> Booking events
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div>
          <h2 className="text-2xl font-semibold md:text-3xl">Attendees</h2>
          <p className="text-muted">{event.title}</p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={!bookings || bookings.length === 0}>
          <DownloadSimple size={20} weight="regular" aria-hidden="true" /> Export CSV
        </Button>
      </div>

      {loadError && (
        <p role="alert" className="mt-2 text-ink">Error: {loadError}</p>
      )}
      {!loadError && bookings === null && <RowsSkeleton />}

      {bookings && totals && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Paid" value={totals.paid} />
            <Stat label="Checked in" value={totals.checkedIn} />
            <Stat label="Cancelled" value={totals.cancelled} />
            <Stat label="Seats left" value={totals.seatsLeft} />
          </div>

          <ul aria-label="Tickets by tier" className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            {tiers.map((t) => (
              <li key={t.tierId}>
                {t.label}: <span className={`${num} text-ink`}>{t.bookings}</span> bookings,{' '}
                <span className={`${num} text-ink`}>{t.seats}</span> seats
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex-1">
              <span className="sr-only">Search attendees</span>
              <input
                type="search"
                className={inputCls}
                placeholder="Search name, email or booking id"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-muted">
              Status
              <select
                className={inputCls}
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusFilter)}
              >
                {STATUS_FILTERS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
          </div>

          {actionError && <p role="alert" className="mt-3 text-ink">Error: {actionError}</p>}

          {bookings.length === 0 && <p className="mt-6 text-muted">No bookings for this event yet.</p>}
          {bookings.length > 0 && shown.length === 0 && (
            <p className="mt-6 text-muted">No bookings match this search or filter.</p>
          )}

          {shown.length > 0 && (
            <>
              <p className="mt-4 text-sm text-muted" aria-live="polite">
                Showing <span className={num}>{shown.length}</span> of <span className={num}>{bookings.length}</span>
              </p>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {shown.map((b) => (
                  <li key={b.id} className="grid grid-cols-1 gap-2 py-4 md:grid-cols-[1.5fr_1fr_5rem_8rem_8rem_auto] md:items-center md:gap-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.buyerName}</p>
                      <p className="truncate font-mono text-sm text-muted">{b.buyerEmail}</p>
                    </div>
                    <p className="text-sm text-muted">{tierLabelOf(event, b.tierId)}</p>
                    <p className={`${num} text-sm`}>Qty {b.qty}</p>
                    <p className={`${num} text-sm`}>{formatInr(b.totalInr)}</p>
                    <p className="font-mono text-xs uppercase tracking-widest">
                      {bookingStatusLabel(b.status)}
                      {b.status === 'cancelled' && b.refund === 'mock_refunded' ? ' (refunded)' : ''}
                    </p>
                    <div>
                      {b.status !== 'cancelled' && b.status !== 'checked_in' && confirmId !== b.id && (
                        <Button variant="secondary" onClick={() => { setActionError(''); setConfirmId(b.id); }}>
                          Cancel
                        </Button>
                      )}
                      {confirmId === b.id && (
                        <div role="group" aria-label={`Confirm cancelling ${b.buyerName}`} className="flex flex-wrap items-center gap-2">
                          <span className="text-sm">Cancel and release {b.qty} seat{b.qty === 1 ? '' : 's'}?</span>
                          <Button disabled={busyId === b.id} onClick={() => void doCancel(b.id)}>
                            {busyId === b.id ? 'Cancelling...' : 'Confirm'}
                          </Button>
                          <Button variant="ghost" disabled={busyId === b.id} onClick={() => setConfirmId(null)}>
                            Keep
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
