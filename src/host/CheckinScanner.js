import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CheckCircle, Warning, QrCode, XCircle } from '@phosphor-icons/react';
import Button from '../components/Button';
import { checkIn, lookupBookingById, watchBookingEvent } from '../lib/bookings';
import { useAuth } from '../lib/auth';
import CardAssign from './CardAssign';
import { inputCls } from './settings/ui';
const formatInr = (n) => `₹${n.toLocaleString('en-IN')}`;
/** One-shot read of a booking event via the existing watcher (mirrors readEvent in
 * src/host/settings/SettingsPage.tsx — no getDoc-based helper for bookingEvents in bookings.ts). */
function readBookingEvent(id) {
    return new Promise((resolve, reject) => {
        let unsub = null;
        let done = false;
        unsub = watchBookingEvent(id, (ev) => {
            done = true;
            unsub?.();
            resolve(ev);
        }, reject);
        if (done)
            unsub();
    });
}
/** Status -> plain-language result for the host, pure and testable. */
export function statusCopy(status) {
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
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);
    const scanningRef = useRef(false);
    const [state, setState] = useState({ kind: 'scanning' });
    const [manualId, setManualId] = useState('');
    const [checkinBusy, setCheckinBusy] = useState(false);
    const [checkinErr, setCheckinErr] = useState(null);
    const [checkedOk, setCheckedOk] = useState(false);
    const stopCamera = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
    }, []);
    const lookup = useCallback(async (id) => {
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
        }
        catch {
            setState({ kind: 'not-found' });
        }
    }, []);
    const tick = useCallback(() => {
        if (!scanningRef.current)
            return;
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
        }
        catch (e) {
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
        }
        else {
            void startCamera();
        }
    }
    async function doCheckIn(booking) {
        if (!user?.email)
            return;
        setCheckinBusy(true);
        setCheckinErr(null);
        try {
            await checkIn(booking.id, user.email);
            setCheckedOk(true);
            setState((s) => s.kind === 'found' ? { ...s, booking: { ...s.booking, status: 'checked_in' } } : s);
        }
        catch (e) {
            setCheckinErr(e instanceof Error ? e.message : 'Check-in failed. Try again.');
        }
        finally {
            setCheckinBusy(false);
        }
    }
    return (_jsxs("div", { className: "mx-auto max-w-md pb-16", children: [_jsx("h2", { className: "py-4 text-2xl font-semibold", children: "Check-in" }), (state.kind === 'scanning' || state.kind === 'camera-unavailable') && (_jsxs("div", { className: "overflow-hidden rounded-lg border border-line bg-raised", children: [_jsxs("div", { className: "relative aspect-square w-full bg-base", children: [_jsx("video", { ref: videoRef, muted: true, playsInline: true, className: `h-full w-full object-cover ${state.kind === 'camera-unavailable' ? 'hidden' : ''}` }), state.kind === 'camera-unavailable' && (_jsxs("div", { className: "flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted", children: [_jsx(QrCode, { size: 32, weight: "regular" }), _jsx("p", { children: "Camera access denied \u2014 use manual entry below." })] }))] }), _jsx("canvas", { ref: canvasRef, className: "hidden" })] })), state.kind === 'looking-up' && (_jsx("p", { role: "status", className: "py-8 text-center text-muted", children: "Looking up ticket..." })), state.kind === 'not-found' && (_jsxs("div", { className: "flex flex-col items-center gap-4 py-8 text-center", children: [_jsx(XCircle, { size: 32, weight: "regular", className: "text-accent-text" }), _jsx("p", { className: "font-medium", children: "Booking not found." }), _jsx(Button, { onClick: scanNext, children: "Scan again" })] })), state.kind === 'found' && (_jsx(ResultCard, { booking: state.booking, event: state.event, busy: checkinBusy, err: checkinErr, ok: checkedOk, onCheckIn: () => void doCheckIn(state.booking), onNext: scanNext })), _jsxs("div", { className: "mt-6 border-t border-line pt-6", children: [_jsx("label", { htmlFor: "manual-id", className: "mb-2 block text-sm font-medium text-muted", children: "Manual entry" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { id: "manual-id", className: `${inputCls} flex-1`, placeholder: "Booking id", value: manualId, onChange: (e) => setManualId(e.target.value) }), _jsx(Button, { variant: "secondary", disabled: !manualId.trim() || state.kind === 'looking-up', onClick: () => void lookup(manualId), children: "Look up" })] })] })] }));
}
function ResultCard({ booking, event, busy, err, ok, onCheckIn, onNext, }) {
    const tier = event?.tiers.find((t) => t.id === booking.tierId);
    const copy = statusCopy(booking.status);
    const seatsPerTicket = booking.seatsPerTicket ?? 1;
    const totalSeats = booking.qty * seatsPerTicket;
    const checkedInCount = booking.checkedInCount ?? 0;
    const isBundled = seatsPerTicket > 1;
    const remainingSeats = totalSeats - checkedInCount;
    const isPartiallyCheckedIn = checkedInCount > 0 && checkedInCount < totalSeats;
    return (_jsxs("div", { className: "rounded-lg border border-line bg-raised p-5", children: [_jsx("p", { className: "text-lg font-semibold", children: booking.buyerName }), _jsx("p", { className: "text-muted", children: event?.title ?? booking.bookingEventId }), _jsxs("dl", { className: "mt-3 grid grid-cols-2 gap-2 text-sm", children: [_jsx("dt", { className: "text-muted", children: "Tier" }), _jsxs("dd", { className: "text-right", children: [tier?.label ?? booking.tierId, " \u00D7 ", booking.qty, isBundled && _jsxs("span", { className: "ml-2 text-xs text-muted", children: ["(", seatsPerTicket, " entries/ticket)"] })] }), _jsx("dt", { className: "text-muted", children: "Total paid" }), _jsx("dd", { className: "text-right font-mono", children: formatInr(booking.totalInr) }), isBundled && (_jsxs(_Fragment, { children: [_jsx("dt", { className: "text-muted", children: "Seats" }), _jsxs("dd", { className: "text-right font-mono", children: [checkedInCount, " / ", totalSeats] })] }))] }), ok ? (_jsxs("div", { className: "mt-4 flex items-center gap-2 text-ink", children: [_jsx(CheckCircle, { size: 20, weight: "regular" }), _jsx("p", { role: "status", children: "Checked in." })] })) : (_jsxs("p", { role: copy.tone === 'ok' ? 'status' : 'alert', className: `mt-4 flex items-center gap-2 ${copy.tone === 'ok' ? 'text-ink' : 'text-accent-text'}`, children: [copy.tone !== 'ok' && _jsx(Warning, { size: 20, weight: "regular" }), booking.status === 'checked_in' && booking.checkedInBy
                        ? `Already checked in by ${booking.checkedInBy}.`
                        : isPartiallyCheckedIn
                            ? `Partially checked in ({checkedInCount}/{totalSeats}).`
                            : copy.msg] })), err && (_jsx("p", { role: "alert", className: "mt-2 text-accent-text", children: err })), (booking.status === 'paid_mock' || isPartiallyCheckedIn) && (_jsx(CardAssign, { booking: booking, event: event }, booking.id)), _jsxs("div", { className: "mt-5 flex flex-wrap gap-3", children: [!ok && (booking.status === 'paid_mock' || isPartiallyCheckedIn) && (_jsxs(_Fragment, { children: [isBundled && remainingSeats > 1 && (_jsxs("div", { className: "flex-1 min-w-[120px]", children: [_jsxs("label", { className: "mb-1 block text-sm font-medium text-muted", children: ["Seats to check in (1-", remainingSeats, ")"] }), _jsx("input", { type: "number", min: 1, max: remainingSeats, defaultValue: remainingSeats, className: inputCls, onChange: (e) => {
                                            const val = Math.min(remainingSeats, Math.max(1, Number(e.target.value) || 1));
                                            onCheckIn(val);
                                        } })] })), _jsx(Button, { disabled: busy, onClick: () => onCheckIn(isBundled ? remainingSeats : undefined), children: busy ? 'Checking in...' : isPartiallyCheckedIn ? `Check in remaining (${remainingSeats})` : 'Check in' })] })), _jsx(Button, { variant: "secondary", onClick: onNext, children: "Scan next" })] })] }));
}
