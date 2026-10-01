import type { RankedRow } from './types';

function cell(v: unknown): string {
  let s = v === undefined || v === null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export function toCsv(
  rows: (RankedRow & { email?: string; phone?: string; submittedAtIso: string })[],
): string {
  const lines = ['rank,name,email,phone,score,submittedAt'];
  for (const r of rows) {
    lines.push(
      [r.rank, r.name, r.email, r.phone, r.score, r.submittedAtIso].map(cell).join(','),
    );
  }
  return lines.join('\r\n');
}
