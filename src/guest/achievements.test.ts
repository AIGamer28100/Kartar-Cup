import { describe, expect, it } from 'vitest';
import { computeAchievements, computeStreaks } from './achievements';
import type { OwnEntryRow } from './profileModel';
import type { Booking, BookingStatus } from '../lib/types';

const row = (id: string, o: Partial<OwnEntryRow> = {}): OwnEntryRow => ({
  eventId: id,
  eventName: id,
  submittedAtMs: 1000,
  score: null,
  ...o,
});
const bk = (status: BookingStatus, ev = 'be1'): Booking => ({ status, bookingEventId: ev }) as Booking;
const get = (list: ReturnType<typeof computeAchievements>, id: string) => list.find((a) => a.id === id)!;
const withOrder = (ns: number[]) => ns.map((n) => row('e' + n, { eventOrder: n }));

describe('computeStreaks', () => {
  it('is zero for empty history', () => {
    expect(computeStreaks([])).toEqual({ current: 0, best: 0 });
  });
  it('counts a single entry as 1', () => {
    expect(computeStreaks([row('a', { eventOrder: 4 })])).toEqual({ current: 1, best: 1 });
  });
  it('counts consecutive event positions', () => {
    expect(computeStreaks(withOrder([0, 1, 2]))).toEqual({ current: 3, best: 3 });
  });
  it('a skipped event breaks the current streak but keeps best', () => {
    expect(computeStreaks(withOrder([0, 1, 2, 4, 5]))).toEqual({ current: 2, best: 3 });
  });
  it('current drops to 1 after a gap, best unchanged', () => {
    expect(computeStreaks(withOrder([0, 1, 2, 3, 7]))).toEqual({ current: 1, best: 4 });
  });
  it('is independent of input order', () => {
    expect(computeStreaks(withOrder([5, 0, 1, 4]))).toEqual({ current: 2, best: 2 });
  });
  it('ignores duplicate event rows', () => {
    const h = [row('a', { eventOrder: 0 }), row('a', { eventOrder: 0, submittedAtMs: 5 }), row('b', { eventOrder: 1 })];
    expect(computeStreaks(h)).toEqual({ current: 2, best: 2 });
  });
  it('treats rows without eventOrder as consecutive', () => {
    expect(computeStreaks([row('a'), row('b', { submittedAtMs: 2 })])).toEqual({ current: 2, best: 2 });
  });
  it('falls back to consecutive when only some rows have eventOrder', () => {
    expect(computeStreaks([row('a', { eventOrder: 0 }), row('b', { eventOrder: 9 }), row('c')]).best).toBe(3);
  });
});

describe('computeAchievements', () => {
  it('nothing earned for a new guest, with zero progress', () => {
    const list = computeAchievements([], []);
    expect(list.every((a) => !a.earned)).toBe(true);
    expect(get(list, 'regular-3').progress).toEqual({ have: 0, need: 3 });
    expect(get(list, 'first-prediction').progress).toEqual({ have: 0, need: 1 });
  });
  it('ids are unique', () => {
    const ids = computeAchievements([], []).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('first prediction earned by an unscored entry', () => {
    expect(get(computeAchievements([row('a')], []), 'first-prediction').earned).toBe(true);
  });
  it('unscored events never earn correctness badges', () => {
    const list = computeAchievements([row('a', { score: null, maxScore: 5 })], []);
    expect(get(list, 'perfect-card').earned).toBe(false);
    expect(get(list, 'sharp-eye').earned).toBe(false);
  });
  it('sharp eye at exactly 3, not at 2', () => {
    expect(get(computeAchievements([row('a', { score: 2, maxScore: 5 })], []), 'sharp-eye').earned).toBe(false);
    expect(get(computeAchievements([row('a', { score: 3, maxScore: 5 })], []), 'sharp-eye').earned).toBe(true);
  });
  it('perfect card needs score == maxScore', () => {
    expect(get(computeAchievements([row('a', { score: 4, maxScore: 5 })], []), 'perfect-card').earned).toBe(false);
    expect(get(computeAchievements([row('a', { score: 5, maxScore: 5 })], []), 'perfect-card').earned).toBe(true);
  });
  it('voided questions shrink maxScore so 4/4 is perfect', () => {
    expect(get(computeAchievements([row('a', { score: 4, maxScore: 4 })], []), 'perfect-card').earned).toBe(true);
  });
  it('0/0 (every question voided) is not a perfect card', () => {
    expect(get(computeAchievements([row('a', { score: 0, maxScore: 0 })], []), 'perfect-card').earned).toBe(false);
  });
  it('missing maxScore never yields a perfect card', () => {
    expect(get(computeAchievements([row('a', { score: 5 })], []), 'perfect-card').earned).toBe(false);
  });
  it('regular counts all entered events, scored or not, and caps progress', () => {
    const h = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => row(id));
    const part = computeAchievements(h.slice(0, 2), []);
    expect(get(part, 'regular-3').progress).toEqual({ have: 2, need: 3 });
    const full = computeAchievements(h, []);
    expect(get(full, 'regular-3').earned).toBe(true);
    expect(get(full, 'regular-5').progress).toEqual({ have: 5, need: 5 });
  });
  it('duplicate event rows count once', () => {
    const list = computeAchievements([row('a'), row('a'), row('a')], []);
    expect(get(list, 'regular-3').progress).toEqual({ have: 1, need: 3 });
  });
  it('duplicate rows: the scored row wins', () => {
    const list = computeAchievements([row('a'), row('a', { score: 3, maxScore: 5 })], []);
    expect(get(list, 'sharp-eye').earned).toBe(true);
  });
  it('streak badge follows best streak, not current', () => {
    expect(get(computeAchievements(withOrder([0, 1, 2, 5]), []), 'streak-3').earned).toBe(true);
    expect(get(computeAchievements(withOrder([0, 2, 4]), []), 'streak-3').progress).toEqual({ have: 1, need: 3 });
  });
  it('early bird ignores cancelled bookings', () => {
    expect(get(computeAchievements([], [bk('cancelled')]), 'early-bird').earned).toBe(false);
    expect(get(computeAchievements([], [bk('reserved')]), 'early-bird').earned).toBe(true);
    expect(get(computeAchievements([], [bk('paid_mock')]), 'early-bird').earned).toBe(true);
  });
  it('watch-party regular needs check-ins at 2 distinct events', () => {
    const same = computeAchievements([], [bk('checked_in'), bk('checked_in')]);
    expect(get(same, 'watch-party-regular').progress).toEqual({ have: 1, need: 2 });
    const two = computeAchievements([], [bk('checked_in', 'x'), bk('checked_in', 'y'), bk('paid_mock', 'z')]);
    expect(get(two, 'watch-party-regular').earned).toBe(true);
  });
  it('does not mutate inputs', () => {
    const h = [row('b', { eventOrder: 1 }), row('a', { eventOrder: 0 })];
    const snap = JSON.stringify(h);
    computeAchievements(h, []);
    computeStreaks(h);
    expect(JSON.stringify(h)).toBe(snap);
  });
});
