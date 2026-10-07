import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CheckCircle, Warning, QrCode, XCircle } from '@phosphor-icons/react';
import Button from '../components/Button';
import { checkIn, getBookingEvent, lookupBookingById } from '../lib/bookings';
import { formatInr } from '../guest/profileModel';
import { useAuth } from '../lib/auth';
import type { Booking, BookingEvent } from '../lib/types';
import CardAssign from './CardAssign';
import { inputCls } from './settings/ui';

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'camera-unavailable'; reason: string }
  | { kind: 'looking-up' }
  | { kind: 'not-found' }
  | { kind: 'found'; booking: Booking; event: BookingEvent | null };

/** Status -> plain-language result for the host, pure and testable. */
export function statusCopy(status: Booking['status']): { tone: 'ok' | 'warn' | 'bad'; msg: string } {
  switch (status) {
    case 'paid_mock':
      return { tone: 'ok', msg: 'Paid — ready to check in.' };
    case 'checked_in':
      return { tone: 'warn', msg: 'Already checked in.' };
    case 'reserved':
      return { tone: 'warn', msg: 'Not paid yet.' };
    case 'cancelled':
      return { tone: 'bad', msg: 'Cancelled booking.' };
  }
}

/** Host door scanner: decode a guest's QR ticket (plain booking id string) via jsQR off a live
 * camera feed, or accept the same id typed manually, then look up and check in the booking.
 * Internal tool — instant transitions only, no spring/motion budget spent here (R20). */
export default function CheckinScanner() {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const lastScanRef = useRef(0);

  const [state, setState] = useState<ScanState>({ kind: 'scanning' });
  const [manualId, setManualId] = useState('');
  const [checkinBusy, setCheckinBusy] = useState(false);
  const [checkinErr, setCheckinErr] = useState<string | null>(null);
  const [checkedOk, setCheckedOk] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const lookup = useCallback(async (id: string) => {
    scanningRef.current = false;
    stopCamera(); // no live camera (battery/privacy) while a result is on screen; "Scan next" restarts it
    setState({ kind: 'looking-up' });
    setCheckinErr(null);
    setCheckedOk(false);
    try {
      const booking = await lookupBookingById(id.trim());
      if (!booking) {
        setState({ kind: 'not-found' });
        return;
      }
      const event = await getBookingEvent(booking.bookingEventId).catch(() => null);
      setState({ kind: 'found', booking, event });
    } catch {
      setState({ kind: 'not-found' });
    }
  }, [stopCamera]);

  const tick = useCallback(() => {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const now = performance.now();
    if (now - lastScanRef.current < 100) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastScanRef.current = now;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      // Decode a downscaled frame (<= 640px): plenty for a ticket QR and far cheaper than full HD.
      const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, imageData.width, imageData.height);
        if (result && result.data) {
          void lookup(result.data);
          return;
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [lookup]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanningRef.current = true;
      setState({ kind: 'scanning' });
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setState({
        kind: 'camera-unavailable',
        reason: e instanceof Error ? e.message : 'Camera unavailable.',
      });
    }
  }, [tick]);

  useEffect(() => {
    void startCamera();
    return () => {
      scanningRef.current = false;
      stopCamera();
    };
    // run once on mount; startCamera/stopCamera are stable across the component's life
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scanNext() {
    setCheckinErr(null);
    setCheckedOk(false);
    setManualId('');
    if (streamRef.current) {
      scanningRef.current = true;
      setState({ kind: 'scanning' });
      rafRef.current = requestAnimationFrame(tick);
    } else {
      void startCamera();
    }
  }

  async function doCheckIn(booking: Booking, count?: number) {
    if (!user?.email) return;
    setCheckinBusy(true);
    setCheckinErr(null);
    try {
      await checkIn(booking.id, user.email.toLowerCase(), count);
      setCheckedOk(true);
      // Re-read: a partial check-in leaves the booking paid_mock with an updated count.
      const fresh = await lookupBookingById(booking.id);
      if (fresh) setState((s) => (s.kind === 'found' ? { ...s, booking: fresh } : s));
    } catch (e) {
      setCheckinErr(e instanceof Error ? e.message : 'Check-in failed. Try again.');
    } finally {
      setCheckinBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md pb-16">
      <h2 className="py-4 text-2xl font-semibold">Check-in</h2>

      {(state.kind === 'scanning' || state.kind === 'camera-unavailable') && (
        <div className="overflow-hidden rounded-lg border border-line bg-raised">
          <div className="relative aspect-square w-full bg-base">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`h-full w-full object-cover ${state.kind === 'camera-unavailable' ? 'hidden' : ''}`}
            />
            {state.kind === 'camera-unavailable' && (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted">
                <QrCode size={32} weight="regular" aria-hidden="true" />
                <p>Camera access denied — use manual entry below.</p>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {state.kind === 'looking-up' && (
        <p role="status" className="py-8 text-center text-muted">
          Looking up ticket...
        </p>
      )}

      {state.kind === 'not-found' && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <XCircle size={32} weight="regular" className="text-accent-text" aria-hidden="true" />
          <p className="font-medium">Booking not found.</p>
          <Button onClick={scanNext}>Scan again</Button>
        </div>
      )}

      {state.kind === 'found' && (
        <ResultCard
          booking={state.booking}
          event={state.event}
          busy={checkinBusy}
          err={checkinErr}
          ok={checkedOk}
          onCheckIn={(count) => void doCheckIn(state.booking, count)}
          onNext={scanNext}
        />
      )}

      <div className="mt-6 border-t border-line pt-6">
        <label htmlFor="manual-id" className="mb-2 block text-sm font-medium text-muted">
          Manual entry
        </label>
        <div className="flex gap-2">
          <input
            id="manual-id"
            className={`${inputCls} flex-1`}
            placeholder="Booking id"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <Button
            variant="secondary"
            disabled={!manualId.trim() || state.kind === 'looking-up'}
            onClick={() => void lookup(manualId)}
          >
            Look up
          </Button>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  booking,
  event,
  busy,
  err,
  ok,
  onCheckIn,
  onNext,
}: {
  booking: Booking;
  event: BookingEvent | null;
  busy: boolean;
  err: string | null;
  ok: boolean;
  onCheckIn: (count?: number) => void;
  onNext: () => void;
}) {
  const tier = event?.tiers.find((t) => t.id === booking.tierId);
  const copy = statusCopy(booking.status);
  const seatsPerTicket = booking.seatsPerTicket ?? 1;
  const totalSeats = booking.qty * seatsPerTicket;
  const checkedInCount = booking.checkedInCount ?? 0;
  const isBundled = seatsPerTicket > 1;
  const remainingSeats = totalSeats - checkedInCount;
  const isPartiallyCheckedIn = checkedInCount > 0 && checkedInCount < totalSeats;
  const [seats, setSeats] = useState(remainingSeats);

  return (
    <div className="rounded-lg border border-line bg-raised p-5">
      <p className="text-lg font-semibold">{booking.buyerName}</p>
      <p className="text-muted">{event?.title ?? booking.bookingEventId}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted">Tier</dt>
        <dd className="text-right">
          {tier?.label ?? booking.tierId} × {booking.qty}
          {isBundled && <span className="ml-2 text-xs text-muted">({seatsPerTicket} entries/ticket)</span>}
        </dd>
        <dt className="text-muted">Total paid</dt>
        <dd className="text-right font-mono">{formatInr(booking.totalInr)}</dd>
        {isBundled && (
          <>
            <dt className="text-muted">Seats</dt>
            <dd className="text-right font-mono">
              {checkedInCount} / {totalSeats}
            </dd>
          </>
        )}
      </dl>

      {ok ? (
        <div className="mt-4 flex items-center gap-2 text-ink">
          <CheckCircle size={20} weight="regular" aria-hidden="true" />
          <p role="status">Checked in.</p>
        </div>
      ) : (
        <p
          role={copy.tone === 'ok' ? 'status' : 'alert'}
          className={`mt-4 flex items-center gap-2 ${copy.tone === 'ok' ? 'text-ink' : 'text-accent-text'}`}
        >
          {copy.tone !== 'ok' && <Warning size={20} weight="regular" aria-hidden="true" />}
          {booking.status === 'checked_in' && booking.checkedInBy
            ? `Already checked in by ${booking.checkedInBy}.`
            : isPartiallyCheckedIn
              ? `Partially checked in (${checkedInCount}/${totalSeats}).`
              : copy.msg}
        </p>
      )}

      {err && (
        <p role="alert" className="mt-2 text-accent-text">
          {err}
        </p>
      )}

      {(booking.status === 'paid_mock' || isPartiallyCheckedIn) && (
        <CardAssign key={booking.id} booking={booking} event={event} />
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {!ok && (booking.status === 'paid_mock' || isPartiallyCheckedIn) && (
          <>
            {isBundled && remainingSeats > 1 && (
              <div className="flex-1 min-w-[120px]">
                <label htmlFor="checkin-seats" className="mb-1 block text-sm font-medium text-muted">
                  Seats to check in (1-{remainingSeats})
                </label>
                <input
                  id="checkin-seats"
                  type="number"
                  min={1}
                  max={remainingSeats}
                  value={seats}
                  className={inputCls}
                  onChange={(e) => setSeats(Math.min(remainingSeats, Math.max(1, Number(e.target.value) || 1)))}
                />
              </div>
            )}
            <Button disabled={busy} onClick={() => onCheckIn(isBundled ? seats : undefined)}>
              {busy ? 'Checking in...' : isPartiallyCheckedIn ? `Check in remaining (${remainingSeats})` : 'Check in'}
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={onNext}>
          Scan next
        </Button>
      </div>
    </div>
  );
}
