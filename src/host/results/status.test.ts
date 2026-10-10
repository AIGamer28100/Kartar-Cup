import { describe, expect, it } from 'vitest';
import { clockLeft, istTime, statusLine, type LastPull } from './status';

const END = Date.UTC(2026, 9, 11, 8, 52); // 14:22 IST
const FROM = END + 30 * 60_000; // 14:52 IST
const last: LastPull = { pulledMs: FROM, attempts: 2, outcome: 'partial', found: 3, total: 5 };

describe('results status line', () => {
  it('formats IST and mm:ss', () => {
    expect(istTime(END)).toBe('14:22 IST');
    expect(clockLeft(65_000)).toBe('1:05');
  });
  it('waiting and blackout', () => {
    expect(statusLine({ state: 'waiting', raceEndMs: END, dataFromMs: FROM }, END, null, false)).toContain('Race finishes 14:22 IST. OpenF1 data is available from 14:52 IST.');
    expect(statusLine({ state: 'blackout', dataFromMs: FROM, msLeft: 90_000 }, END, null, false)).toContain('Available in 1:30.');
  });
  it('pulling, retrying, ready, stopped', () => {
    expect(statusLine({ state: 'pull', dataFromMs: FROM }, END, null, true)).toContain('Pulling now...');
    expect(statusLine({ state: 'retrying', dataFromMs: FROM, nextPullMs: 0, msLeft: 60_000 }, END, last, false)).toContain('retrying in 1:00 (attempt 2 of 10)');
    expect(statusLine({ state: 'ready', dataFromMs: FROM }, END, last, false)).toContain('3 of 5 answers found. Review and publish.');
    expect(statusLine({ state: 'stopped', dataFromMs: FROM }, END, last, false)).toContain('Stopped after 10 attempts');
  });
});
