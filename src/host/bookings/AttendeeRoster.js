import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, DownloadSimple } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import { cancelBooking, watchAllBookings } from '../../lib/bookings';
import { bookingsToCsv } from '../../lib/csv';
import { bookingStatusLabel, formatInr } from '../../guest/profileModel';
import { inputCls } from '../settings/ui';
import { STATUS_FILTERS, filterBookings, tally, tierCounts, tierLabelOf, toCsvRows, } from './roster';
const num = 'font-mono tabular-nums';
function Stat({ label, value }) {
    return (_jsxs("div", { className: "rounded-lg border border-line px-3 py-2", children: [_jsx("p", { className: "font-mono text-xs uppercase tracking-widest text-muted", children: label }), _jsx("p", { className: `${num} mt-1 text-2xl font-semibold`, children: value })] }));
}
/** Host attendee roster for one booking event: live bookings, search + status filter, tallies,
 * per-row host cancel (confirmed) and CSV export. Host-only (rules gate the bookings query). */
export default function AttendeeRoster({ event, onBack }) {
    const [bookings, setBookings] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [confirmId, setConfirmId] = useState(null);
    const [busyId, setBusyId] = useState(null);
    const [actionError, setActionError] = useState('');
    useEffect(() => {
        setBookings(null);
        setLoadError('');
        return watchAllBookings(event.id, (b) => setBookings([...b].sort((x, y) => (y.createdAt?.toMillis?.() ?? 0) - (x.createdAt?.toMillis?.() ?? 0))), (e) => setLoadError(e.message || 'Could not load bookings.'));
    }, [event.id]);
    const shown = useMemo(() => (bookings ? filterBookings(bookings, query, status) : []), [bookings, query, status]);
    const totals = useMemo(() => (bookings ? tally(bookings, event) : null), [bookings, event]);
    const tiers = useMemo(() => (bookings ? tierCounts(bookings, event) : []), [bookings, event]);
    async function doCancel(id) {
        setBusyId(id);
        setActionError('');
        try {
            await cancelBooking(id, 'host');
            setConfirmId(null);
        }
        catch (e) {
            setActionError(e instanceof Error ? e.message : 'Could not cancel the booking.');
        }
        finally {
            setBusyId(null);
        }
    }
    function exportCsv() {
        if (!bookings)
            return;
        const url = URL.createObjectURL(new Blob([bookingsToCsv(toCsvRows(bookings, event))], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${event.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-bookings.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
    return (_jsxs("div", { children: [_jsxs("button", { type: "button", onClick: onBack, className: "inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink", children: [_jsx(ArrowLeft, { size: 20, weight: "regular", "aria-hidden": "true" }), " Booking events"] }), _jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 py-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: "Attendees" }), _jsx("p", { className: "text-muted", children: event.title })] }), _jsxs(Button, { variant: "secondary", onClick: exportCsv, disabled: !bookings || bookings.length === 0, children: [_jsx(DownloadSimple, { size: 20, weight: "regular", "aria-hidden": "true" }), " Export CSV"] })] }), loadError && (_jsxs("p", { role: "alert", className: "mt-2 text-ink", children: ["Error: ", loadError] })), !loadError && bookings === null && _jsx(RowsSkeleton, {}), bookings && totals && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-3 md:grid-cols-4", children: [_jsx(Stat, { label: "Paid", value: totals.paid }), _jsx(Stat, { label: "Checked in", value: totals.checkedIn }), _jsx(Stat, { label: "Cancelled", value: totals.cancelled }), _jsx(Stat, { label: "Seats left", value: totals.seatsLeft })] }), _jsx("ul", { "aria-label": "Tickets by tier", className: "mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted", children: tiers.map((t) => (_jsxs("li", { children: [t.label, ": ", _jsx("span", { className: `${num} text-ink`, children: t.bookings }), " bookings,", ' ', _jsx("span", { className: `${num} text-ink`, children: t.seats }), " seats"] }, t.tierId))) }), _jsxs("div", { className: "mt-6 flex flex-col gap-3 md:flex-row md:items-center", children: [_jsxs("label", { className: "flex-1", children: [_jsx("span", { className: "sr-only", children: "Search attendees" }), _jsx("input", { type: "search", className: inputCls, placeholder: "Search name, email or booking id", value: query, onChange: (e) => setQuery(e.target.value) })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-muted", children: ["Status", _jsx("select", { className: inputCls, value: status, onChange: (e) => setStatus(e.target.value), children: STATUS_FILTERS.map((f) => (_jsx("option", { value: f.value, children: f.label }, f.value))) })] })] }), actionError && _jsxs("p", { role: "alert", className: "mt-3 text-ink", children: ["Error: ", actionError] }), bookings.length === 0 && _jsx("p", { className: "mt-6 text-muted", children: "No bookings for this event yet." }), bookings.length > 0 && shown.length === 0 && (_jsx("p", { className: "mt-6 text-muted", children: "No bookings match this search or filter." })), shown.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("p", { className: "mt-4 text-sm text-muted", "aria-live": "polite", children: ["Showing ", _jsx("span", { className: num, children: shown.length }), " of ", _jsx("span", { className: num, children: bookings.length })] }), _jsx("ul", { className: "mt-2 divide-y divide-line border-y border-line", children: shown.map((b) => (_jsxs("li", { className: "grid grid-cols-1 gap-2 py-4 md:grid-cols-[1.5fr_1fr_5rem_8rem_8rem_auto] md:items-center md:gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "truncate font-medium", children: b.buyerName }), _jsx("p", { className: "truncate font-mono text-sm text-muted", children: b.buyerEmail })] }), _jsx("p", { className: "text-sm text-muted", children: tierLabelOf(event, b.tierId) }), _jsxs("p", { className: `${num} text-sm`, children: ["Qty ", b.qty] }), _jsx("p", { className: `${num} text-sm`, children: formatInr(b.totalInr) }), _jsxs("p", { className: "font-mono text-xs uppercase tracking-widest", children: [bookingStatusLabel(b.status), b.status === 'cancelled' && b.refund === 'mock_refunded' ? ' (refunded)' : ''] }), _jsxs("div", { children: [b.status !== 'cancelled' && b.status !== 'checked_in' && confirmId !== b.id && (_jsx(Button, { variant: "secondary", onClick: () => { setActionError(''); setConfirmId(b.id); }, children: "Cancel" })), confirmId === b.id && (_jsxs("div", { role: "group", "aria-label": `Confirm cancelling ${b.buyerName}`, className: "flex flex-wrap items-center gap-2", children: [_jsxs("span", { className: "text-sm", children: ["Cancel and release ", b.qty, " seat", b.qty === 1 ? '' : 's', "?"] }), _jsx(Button, { disabled: busyId === b.id, onClick: () => void doCancel(b.id), children: busyId === b.id ? 'Cancelling...' : 'Confirm' }), _jsx(Button, { variant: "ghost", disabled: busyId === b.id, onClick: () => setConfirmId(null), children: "Keep" })] }))] })] }, b.id))) })] }))] }))] }));
}
