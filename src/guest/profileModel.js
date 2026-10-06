export function sortOwnEntries(rows) {
    return [...rows].sort((a, b) => b.submittedAtMs - a.submittedAtMs);
}
export function entryStatusLabel(row) {
    return row.score === null ? 'Picks locked in — pending results' : `Scored ${row.score}/5`;
}
const BOOKING_STATUS_LABEL = {
    reserved: 'Reserved',
    paid_mock: 'Paid (sample)',
    checked_in: 'Checked in',
    cancelled: 'Cancelled',
};
export function bookingStatusLabel(status) {
    return BOOKING_STATUS_LABEL[status] ?? status;
}
export function formatInr(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(amount);
}
/** Two-letter fallback avatar mark from a display name, else the email's first two chars. */
export function initials(name, email) {
    const src = (name ?? '').trim();
    if (src) {
        const parts = src.split(/\s+/).filter(Boolean);
        const chars = parts.length > 1 ? [parts[0][0], parts[parts.length - 1][0]] : [src.slice(0, 2)];
        return chars.join('').toUpperCase().slice(0, 2);
    }
    const e = (email ?? '').trim();
    return e ? e.slice(0, 2).toUpperCase() : '??';
}
