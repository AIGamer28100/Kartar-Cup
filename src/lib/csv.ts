import type { RankedRow } from './types';

function cell(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v);
  // Formula-injection guard. A plain phone number (+91 98765 43210) is left alone; other + text is not.
  if (/^[=\-@|\t\r]/.test(s) || (/^\+/.test(s) && !/^\+[\d\s\-()]+$/.test(s))) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(
  rows: (RankedRow & { email?: string; phone?: string; submittedAtIso: string })[],
): string {
  // score = total (quiz + Play-card bonus, R46); the split is appended so existing column order holds.
  const lines = ['rank,name,email,phone,score,submittedAt,quizScore,cardBonus'];
  for (const r of rows) {
    lines.push(
      [r.rank, r.name, r.email, r.phone, r.score, r.submittedAtIso, r.quizScore ?? r.score, r.bonus ?? 0].map(cell).join(','),
    );
  }
  return lines.join('\r\n');
}

export interface BookingCsvRow {
  id: string;
  name: string;
  email: string;
  tier: string;
  qty: number;
  status: string;
  totalInr: number;
  discountCode?: string;
  paidAtIso?: string;
  checkedInAtIso?: string;
  cancelledAtIso?: string;
  refund?: string;
  createdAtIso?: string;
}

/** Host attendee export. Same injection-safe cell() as toCsv (formula-leading text is prefixed). */
export function bookingsToCsv(rows: BookingCsvRow[]): string {
  const lines = ['bookingId,name,email,tier,qty,status,totalInr,discountCode,paidAt,checkedInAt,cancelledAt,refund,createdAt'];
  for (const r of rows) {
    lines.push(
      [r.id, r.name, r.email, r.tier, r.qty, r.status, r.totalInr, r.discountCode, r.paidAtIso,
        r.checkedInAtIso, r.cancelledAtIso, r.refund, r.createdAtIso].map(cell).join(','),
    );
  }
  return lines.join('\r\n');
}
