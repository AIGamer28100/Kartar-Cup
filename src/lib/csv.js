function cell(v) {
    let s = v === undefined || v === null ? '' : String(v);
    if (/^[=+\-@]/.test(s))
        s = "'" + s;
    if (/[",\r\n]/.test(s))
        s = '"' + s.replace(/"/g, '""') + '"';
    return s;
}
export function toCsv(rows) {
    // score = total (quiz + Play-card bonus, R46); the split is appended so existing column order holds.
    const lines = ['rank,name,email,phone,score,submittedAt,quizScore,cardBonus'];
    for (const r of rows) {
        lines.push([r.rank, r.name, r.email, r.phone, r.score, r.submittedAtIso, r.quizScore ?? r.score, r.bonus ?? 0].map(cell).join(','));
    }
    return lines.join('\r\n');
}
/** Host attendee export. Same injection-safe cell() as toCsv (formula-leading text is prefixed). */
export function bookingsToCsv(rows) {
    const lines = ['bookingId,name,email,tier,qty,status,totalInr,discountCode,paidAt,checkedInAt,cancelledAt,refund,createdAt'];
    for (const r of rows) {
        lines.push([r.id, r.name, r.email, r.tier, r.qty, r.status, r.totalInr, r.discountCode, r.paidAtIso,
            r.checkedInAtIso, r.cancelledAtIso, r.refund, r.createdAtIso].map(cell).join(','));
    }
    return lines.join('\r\n');
}
