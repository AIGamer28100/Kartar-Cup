import { describe, expect, it } from 'vitest';
import {
  computeStandings, fmtRoundDate, parsePointsTable, pickSeason, validatePointsTable,
  type CupDriver, type RoundWithResult,
} from './cupScoring';

const D = (id: string, name = id, extra: Partial<CupDriver> = {}): CupDriver => ({ id, name, active: true, ...extra });
const R = (id: string, order: number, result: RoundWithResult['result'], over: Partial<RoundWithResult> = {}): RoundWithResult => ({
  id, name: id, date: '2026-01-01', order, status: 'completed', published: true, result, ...over,
});
const T = [10, 6, 3, 1];
const pointsOf = (s: ReturnType<typeof computeStandings>, id: string) => s.drivers.find((r) => r.driverId === id)!;

describe('computeStandings', () => {
  it('empty inputs give empty standings', () => {
    expect(computeStandings([], [], T)).toEqual({ drivers: [], teams: [], roundsCounted: 0 });
  });
  it('awards points by position and counts wins/podiums/rounds', () => {
    const s = computeStandings([D('a'), D('b'), D('c')], [R('r1', 1, { order: ['b', 'a', 'c'] })], T);
    expect(s.drivers.map((r) => [r.driverId, r.points, r.wins, r.podiums, r.rounds])).toEqual([
      ['b', 10, 1, 1, 1], ['a', 6, 0, 1, 1], ['c', 3, 0, 1, 1],
    ]);
    expect(s.roundsCounted).toBe(1);
  });
  it('positions beyond the table score 0 but still count as a start', () => {
    const s = computeStandings([D('a'), D('b'), D('c'), D('d'), D('e')], [R('r', 1, { order: ['a', 'b', 'c', 'd', 'e'] })], T);
    const e = pointsOf(s, 'e');
    expect([e.points, e.rounds, e.podiums]).toEqual([0, 1, 0]);
  });
  it('ignores unpublished, scheduled and result-less rounds', () => {
    const s = computeStandings([D('a')], [
      R('u', 1, { order: ['a'] }, { published: false }),
      R('s', 2, { order: ['a'] }, { status: 'scheduled' }),
      R('n', 3, null),
      R('m', 4, undefined),
    ], T);
    expect(s.roundsCounted).toBe(0);
    expect(s.drivers[0].points).toBe(0);
  });
  it('DNF scores nothing, counts as a start, and takes no slot', () => {
    const s = computeStandings([D('a'), D('b'), D('c')], [R('r', 1, { order: ['a', 'c'], dnf: ['b'] })], T);
    expect([pointsOf(s, 'b').points, pointsOf(s, 'b').rounds, pointsOf(s, 'b').bestFinish]).toEqual([0, 1, null]);
    expect(pointsOf(s, 'c').points).toBe(6);
  });
  it('a driver in both order and dnf is a DNF', () => {
    const s = computeStandings([D('a'), D('b')], [R('r', 1, { order: ['a', 'b'], dnf: ['a'] })], T);
    expect(pointsOf(s, 'b').wins).toBe(1);
    expect(pointsOf(s, 'a').points).toBe(0);
  });
  it('duplicate ids count once', () => {
    const s = computeStandings([D('a'), D('b')], [R('r', 1, { order: ['a', 'a', 'b'] })], T);
    expect(pointsOf(s, 'b').points).toBe(6);
    expect(pointsOf(s, 'a').rounds).toBe(1);
  });
  it('removed driver keeps their slot and is omitted', () => {
    const s = computeStandings([D('a'), D('b')], [R('r', 1, { order: ['gone', 'a', 'b'] })], T);
    expect(s.drivers.map((r) => r.driverId)).toEqual(['a', 'b']);
    expect(s.drivers[0].points).toBe(6);
  });
  it('inactive drivers show only if they started a counted round', () => {
    const ds = [D('a'), D('x', 'x', { active: false }), D('y', 'y', { active: false })];
    const s = computeStandings(ds, [R('r', 1, { order: ['a', 'x'] })], T);
    expect(s.drivers.map((r) => r.driverId).sort()).toEqual(['a', 'x']);
  });
  it('fastest lap bonus applies only when enabled and not for DNF/unknown', () => {
    const rs = [R('r', 1, { order: ['a', 'b'], fastestLap: 'b' })];
    expect(pointsOf(computeStandings([D('a'), D('b')], rs, T, 0), 'b').points).toBe(6);
    expect(pointsOf(computeStandings([D('a'), D('b')], rs, T, 1), 'b').points).toBe(7);
    const dnf = [R('r', 1, { order: ['a'], dnf: ['b'], fastestLap: 'b' })];
    expect(pointsOf(computeStandings([D('a'), D('b')], dnf, T, 1), 'b').points).toBe(0);
    expect(computeStandings([D('a')], [R('r', 1, { order: ['a'], fastestLap: 'zz' })], T, 1).drivers[0].points).toBe(10);
  });
  it('sanitises garbage in the points table', () => {
    const s = computeStandings([D('a')], [R('r', 1, { order: ['a'] })], [NaN, -5]);
    expect(s.drivers[0].points).toBe(0);
  });
  it('tie-break: points, wins, podiums, best finish, then name', () => {
    const rs = [R('r1', 1, { order: ['a', 'b', 'c', 'd'] }), R('r2', 2, { order: ['c', 'd', 'a', 'b'] })];
    const s = computeStandings([D('a'), D('b'), D('c'), D('d')], rs, [5, 5, 5, 5]);
    expect(s.drivers.map((r) => r.driverId)).toEqual(['a', 'c', 'b', 'd']);
  });
  it('more wins beats equal points', () => {
    const rs = [R('r1', 1, { order: ['a', 'b'] }), R('r2', 2, { order: ['b', 'a'] }), R('r3', 3, { order: ['a', 'b'] })];
    expect(computeStandings([D('b'), D('a')], rs, [1, 1]).drivers[0].driverId).toBe('a');
  });
  it('more podiums beats equal points and wins', () => {
    const rs = [R('r1', 1, { order: ['x', 'a', 'b'] }), R('r2', 2, { order: ['y', 'a', 'z', 'b'] })];
    // a: 2 podiums (2nd,2nd); b: 3rd + 4th = 1 podium. table gives equal points
    const s = computeStandings([D('a'), D('b'), D('x'), D('y'), D('z')], rs, [0, 5, 5, 5]);
    const ids = s.drivers.map((r) => r.driverId);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
  });
  it('name tie-break is case-insensitive, then id', () => {
    const s = computeStandings([D('2', 'bob'), D('1', 'Alice'), D('3', 'alice')], [], T);
    expect(s.drivers.map((r) => r.driverId)).toEqual(['1', '3', '2']);
  });
  it('is deterministic regardless of input order', () => {
    const ds = [D('a'), D('b'), D('c')];
    const rs = [R('r1', 1, { order: ['a', 'b'] }), R('r2', 2, { order: ['b', 'c'] })];
    expect(computeStandings([...ds].reverse(), [...rs].reverse(), T)).toEqual(computeStandings(ds, rs, T));
  });
  it('builds team standings only from drivers with a team', () => {
    const ds = [D('a', 'a', { team: 'Red' }), D('b', 'b', { team: 'Red' }), D('c', 'c', { team: 'Blue' }), D('d')];
    const s = computeStandings(ds, [R('r', 1, { order: ['a', 'c', 'b', 'd'] })], T);
    expect(s.teams).toEqual([
      { team: 'Red', points: 13, wins: 1, podiums: 2 },
      { team: 'Blue', points: 6, wins: 0, podiums: 1 },
    ]);
  });
  it('no teams when nobody has one', () => {
    expect(computeStandings([D('a')], [], T).teams).toEqual([]);
  });
});

describe('points table helpers', () => {
  it('validates', () => {
    expect(validatePointsTable([])).not.toBe('');
    expect(validatePointsTable(new Array(21).fill(1))).not.toBe('');
    expect(validatePointsTable([1.5])).not.toBe('');
    expect(validatePointsTable([-1])).not.toBe('');
    expect(validatePointsTable([1001])).not.toBe('');
    expect(validatePointsTable([NaN])).not.toBe('');
    expect(validatePointsTable([25, 18, 0])).toBe('');
  });
  it('parses', () => {
    expect(parsePointsTable('25, 18  15')).toEqual([25, 18, 15]);
    expect(parsePointsTable('')).toEqual([]);
    expect(Number.isNaN(parsePointsTable('a')[0])).toBe(true);
    expect(Number.isNaN(parsePointsTable('-3')[0])).toBe(true);
  });
});

describe('misc', () => {
  it('fmtRoundDate is timezone-stable and tolerant', () => {
    expect(fmtRoundDate('2026-03-05')).toBe('5 Mar 2026');
    expect(fmtRoundDate('junk')).toBe('junk');
  });
  it('pickSeason prefers active then newest year', () => {
    expect(pickSeason([])).toBeNull();
    const a = { name: 'A', year: 2026, status: 'completed' as const };
    const b = { name: 'B', year: 2025, status: 'active' as const };
    const c = { name: 'C', year: 2027, status: 'upcoming' as const };
    expect(pickSeason([a, b, c])).toBe(b);
    expect(pickSeason([a, c])).toBe(c);
  });
});
