export const STATUS_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'reserved', label: 'Reserved' },
    { value: 'paid_mock', label: 'Paid' },
    { value: 'checked_in', label: 'Checked in' },
    { value: 'cancelled', label: 'Cancelled' },
];
export function tierLabelOf(ev, tierId) {
    return ev?.tiers.find((t) => t.id === tierId)?.label ?? tierId;
}
/** Case-insensitive search over name, email and booking id, plus a status filter. */
export function filterBookings(bookings, query, status) {
    const q = query.trim().toLowerCase();
    return bookings.filter((b) => {
        if (status !== 'all' && b.status !== status)
            return false;
        if (!q)
            return true;
        return (b.buyerName.toLowerCase().includes(q) ||
            b.buyerEmail.toLowerCase().includes(q) ||
            b.id.toLowerCase().includes(q));
    });
}
export function tally(bookings, ev) {
    let paid = 0, checkedIn = 0, cancelled = 0, reserved = 0, activeSeats = 0;
    for (const b of bookings) {
        if (b.status === 'cancelled') {
            cancelled++;
            continue;
        }
        activeSeats += b.qty;
        if (b.status === 'reserved')
            reserved++;
        else if (b.status === 'paid_mock')
            paid++;
        else if (b.status === 'checked_in') {
            paid++;
            checkedIn++;
        }
    }
    return { paid, checkedIn, cancelled, reserved, activeSeats, seatsLeft: Math.max(0, ev.capacity - ev.bookedCount) };
}
/** Non-cancelled bookings and seats per tier. Event tiers come first in order (zeros included);
 * tiers that were since deleted from the event but still have bookings are appended. */
export function tierCounts(bookings, ev) {
    const map = new Map();
    for (const t of ev?.tiers ?? [])
        map.set(t.id, { tierId: t.id, label: t.label, bookings: 0, seats: 0 });
    for (const b of bookings) {
        if (b.status === 'cancelled')
            continue;
        const row = map.get(b.tierId) ?? { tierId: b.tierId, label: b.tierId, bookings: 0, seats: 0 };
        row.bookings++;
        row.seats += b.qty;
        map.set(b.tierId, row);
    }
    return [...map.values()];
}
const iso = (t) => t ? new Date(t.toMillis()).toISOString() : undefined;
export function toCsvRows(bookings, ev) {
    return bookings.map((b) => ({
        id: b.id,
        name: b.buyerName,
        email: b.buyerEmail,
        tier: tierLabelOf(ev, b.tierId),
        qty: b.qty,
        status: b.status,
        totalInr: b.totalInr,
        discountCode: b.discountCode,
        paidAtIso: iso(b.paidAt),
        checkedInAtIso: iso(b.checkedInAt),
        cancelledAtIso: iso(b.cancelledAt),
        refund: b.refund,
        createdAtIso: iso(b.createdAt),
    }));
}
