import { describe, it, expect } from 'vitest';
import { bookingsToCsv, toCsv } from './csv';
import type { Answers } from './types';

const answers: Answers = { q1: 'a', q2: 'a', q3: 'a', q4: 'a', q5: 'a' };
const row = (name: string) => ({
  uid: 'u', name, answers, submittedAtMs: 0, score: 3, ticks: { q1: true, q2: true, q3: true, q4: false, q5: false },
  rank: 1, tiedOnScore: false, submittedAtIso: '2026-09-26T10:00:00Z',
});

describe('toCsv', () => {
  it('has header', () => {
    expect(toCsv([]).split('\r\n')[0]).toBe('rank,name,email,phone,score,submittedAt');
  });
  it('quotes commas, quotes and newlines', () => {
    const out = toCsv([row('a,b "c"\nd')]);
    expect(out).toContain('"a,b ""c""\nd"');
  });
  it('prefixes injection cells', () => {
    expect(toCsv([row('=cmd')])).toContain(",'=cmd,");
  });
});

describe('bookingsToCsv', () => {
  const r = (over: Record<string, unknown> = {}) => ({
    id: 'b1', name: 'Asha', email: 'a@x.com', tier: 'Single', qty: 2, status: 'paid_mock', totalInr: 1000, ...over,
  });
  it('has header and one line per booking', () => {
    const lines = bookingsToCsv([r(), r({ id: 'b2' })]).split('\r\n');
    expect(lines[0]).toBe('bookingId,name,email,tier,qty,status,totalInr,discountCode,paidAt,checkedInAt,cancelledAt,refund,createdAt');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('b1,Asha,a@x.com,Single,2,paid_mock,1000,,,,,,');
  });
  it('quotes commas and neutralises formula injection in name/email/tier', () => {
    const out = bookingsToCsv([r({ name: '=HYPERLINK("x")', email: '+a@x.com', tier: 'A, B' })]);
    expect(out).toContain(`"'=HYPERLINK(""x"")"`);
    expect(out).toContain(",'+a@x.com,");
    expect(out).toContain('"A, B"');
  });
});
