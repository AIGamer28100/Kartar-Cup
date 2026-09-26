import { describe, it, expect } from 'vitest';
import { toCsv } from './csv';
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
