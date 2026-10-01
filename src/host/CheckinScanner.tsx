import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CheckCircle, Warning, QrCode, XCircle } from '@phosphor-icons/react';
import Button from '../components/Button';
import { checkIn, lookupBookingById, watchBookingEvent } from '../lib/bookings';
import { useAuth } from '../lib/auth';
import type { Booking, BookingEvent } from '../lib/types';
import { inputCls } from './settings/ui';

const formatInr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** One-shot read of a booking event via the existing watcher (mirrors readEvent in
 * src/host/settings/SettingsPage.tsx — no getDoc-based helper for bookingEvents in bookings.ts). */
function readBookingEvent(id: string): Promise<BookingEvent | null> {
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | null = null;
    let done = false;
    unsub = watchBookingEvent(
      id,
      (ev) => {
        done = true;
        unsub?.();
        resolve(ev);
      },
      reject,
    );
    if (done) unsub();
  });
}

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
    setState({ kind: 'looking-up' });
    setCheckinErr(null);
    setCheckedOk(false);
    try {
      const booking = await lookupBookingById(id.trim());
      if (!booking) {
        setState({ kind: 'not-found' });
        return;
      }
      const event = await readBookingEvent(booking.bookingEventId).catch(() => null);
      setState({ kind: 'found', booking, event });
    } catch {
      setState({ kind: 'not-found' });
    }
  }, []);

  const tick = useCallback(() => {
    if (!scanningRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
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

  async function doCheckIn(booking: Booking) {
    if (!user?.email) return;
    setCheckinBusy(true);
    setCheckinErr(null);
    try {
      await checkIn(booking.id, user.email);
      setCheckedOk(true);
      setState((s) =>
        s.kind === 'found' ? { ...s, booking: { ...s.booking, status: 'checked_in' } } : s,
      );
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
                <QrCode size={32} weight="regular" />
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
          <XCircle size={32} weight="regular" className="text-accent" />
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
          onCheckIn={() => void doCheckIn(state.booking)}
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
  onCheckIn: () => void;
  onNext: () => void;
}) {
  const tier = event?.tiers.find((t) => t.id === booking.tierId);
  const copy = statusCopy(booking.status);

  return (
    <div className="rounded-lg border border-line bg-raised p-5">
      <p className="text-lg font-semibold">{booking.buyerName}</p>
      <p className="text-muted">{event?.title ?? booking.bookingEventId}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <dt className="text-muted">Tier</dt>
        <dd className="text-right">
          {tier?.label ?? booking.tierId} × {booking.qty}
        </dd>
        <dt className="text-muted">Total paid</dt>
        <dd className="text-right font-mono">{formatInr(booking.totalInr)}</dd>
      </dl>

      {ok ? (
        <div className="mt-4 flex items-center gap-2 text-ink">
          <CheckCircle size={20} weight="regular" />
          <p role="status">Checked in.</p>
        </div>
      ) : (
        <p
          role={copy.tone === 'ok' ? 'status' : 'alert'}
          className={`mt-4 flex items-center gap-2 ${copy.tone === 'ok' ? 'text-ink' : 'text-accent'}`}
        >
          {copy.tone !== 'ok' && <Warning size={20} weight="regular" />}
          {booking.status === 'checked_in' && booking.checkedInBy
            ? `Already checked in by ${booking.checkedInBy}.`
            : copy.msg}
        </p>
      )}

      {err && (
        <p role="alert" className="mt-2 text-accent">
          {err}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {!ok && booking.status === 'paid_mock' && (
          <Button disabled={busy} onClick={onCheckIn}>
            {busy ? 'Checking in...' : 'Check in'}
          </Button>
        )}
        <Button variant="secondary" onClick={onNext}>
          Scan next
        </Button>
      </div>
    </div>
  );
}
