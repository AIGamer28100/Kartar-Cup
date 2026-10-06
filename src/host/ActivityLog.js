import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { RowsSkeleton } from '../components/Skeleton';
import { watchAuditLog } from '../lib/audit';
import { fmtLocal } from './settings/time';
/** Plain-English labels so the log reads as a history, not as internal identifiers. */
const LABELS = {
    'event.save': 'Saved event settings',
    'event.go-live': 'Set the live event',
    'event.override': 'Changed picks override',
    'event.extend-closes': 'Moved the closing time',
    'event.set-lights-out': 'Set the lights-out time',
    'results.save': 'Saved race results',
    'winner.reveal': 'Revealed the winner',
    'booking-event.create': 'Created a booking event',
    'booking-event.update': 'Edited a booking event',
    'cup.season': 'Changed a Cup season',
    'cup.driver': 'Changed a Cup driver',
    'cup.round': 'Changed a Cup round',
    'cup.results': 'Saved Cup round results',
    'cup.standings': 'Recomputed Cup standings',
    'booking.check-in': 'Checked a guest in',
    'content.partner': 'Changed a partner',
    'content.story': 'Changed a story',
    'content.legal': 'Changed a legal document link',
    'card.save': 'Saved an event card design',
    'card.delete': 'Deleted an event card design',
    'card.assign': 'Assigned a guest their VIP pass and Play card',
    'user.roles': 'Changed someone’s roles',
    'invite.create': 'Created an invite link',
    'invite.revoke': 'Revoked an invite link',
};
export default function ActivityLog() {
    const [rows, setRows] = useState(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => watchAuditLog((r) => {
        setFailed(false);
        setRows(r);
    }, () => {
        setFailed(true);
        setRows([]);
    }), []);
    return (_jsxs("section", { "aria-label": "Activity", className: "py-6", children: [_jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: "Activity" }), _jsx("p", { className: "mt-1 max-w-2xl text-muted", children: "The last 100 actions taken from the host console. Entries cannot be edited or deleted." }), rows === null ? (_jsx(RowsSkeleton, {})) : failed ? (_jsx("p", { role: "alert", className: "mt-6 text-accent-text", children: "Couldn\u2019t load the activity log. Try refreshing." })) : rows.length === 0 ? (_jsx("p", { className: "mt-6 text-muted", children: "Nothing recorded yet." })) : (_jsx("ol", { className: "mt-6 divide-y divide-line border-y border-line", children: rows.map((r) => (_jsxs("li", { className: "grid gap-x-6 gap-y-1 py-3 md:grid-cols-[11rem_1fr_16rem] md:items-baseline", children: [_jsx("span", { className: "font-mono text-sm text-muted", children: fmtLocal(r.at.toMillis()) }), _jsxs("span", { children: [_jsx("span", { className: "text-ink", children: LABELS[r.action] ?? r.action }), _jsx("span", { className: "ml-2 font-mono text-sm text-muted", children: r.target }), r.detail && _jsx("span", { className: "mt-0.5 block text-sm text-muted", children: r.detail })] }), _jsx("span", { className: "truncate text-sm text-muted md:text-right", children: r.actor })] }, r.id))) }))] }));
}
