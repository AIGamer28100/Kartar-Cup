import { describe, expect, it } from 'vitest';
import type { RaceInfo } from '../config/calendar';
import type { BookingEvent } from '../lib/types';
import {
  allItems,
  categoryOf,
  defaultTab,
  eventsInCategory,
  nextHostedRace,
  parseTab,
  partitionByTime,
  standaloneEvents,
  ticketStatusFor,
} from './eventsModel';

const race = (id: string, round: number, raceDate: string, status: RaceInfo['status'] = 'scheduled'): RaceInfo => ({
  id,
  season: 2026,
  round,
  name: `Race ${round}`,
  shortName: `R${round}`,
  circuit: null,
  locality: 'City',
  country: 'Country',
  weekendStart: raceDate,
  weekendEnd: raceDate,
  raceDate,
  hasSprint: false,
  themeId: id,
  status,
});

const ev = (id: string, over: Partial<BookingEvent> = {}): BookingEvent =>
  ({ id, title: id, dateUtc: '2026-10-20T08:00:00Z', salesOpen: true, ...over }) as unknown as BookingEvent;

describe('hosted label decision (R47/R49)', () => {
  it('Singapore hosted + sales open -> open with link id', () => {
    const t = ticketStatusFor('2026-r17-singapore', [ev('sg', { raceId: '2026-r17-singapore', hosted: true })]);
    expect(t).toEqual({ available: true, bookingEventId: 'sg', state: 'open' });
  });
  it('hosted + sales closed -> soon (booking opening soon), not available', () => {
    const t = ticketStatusFor('2026-r17-singapore', [
      ev('sg', { raceId: '2026-r17-singapore', hosted: true, salesOpen: false }),
    ]);
    expect(t).toEqual({ available: false, bookingEventId: 'sg', state: 'soon' });
  });
  it('Malaysia with no booking event -> none (renders nothing)', () => {
    const events = [ev('sg', { raceId: '2026-r17-singapore', hosted: true })];
    expect(ticketStatusFor('2026-r16-malaysia', events).state).toBe('none');
  });
  it('closed legacy doc (no hosted flag) is not hosted', () => {
    expect(ticketStatusFor('r', [ev('a', { raceId: 'r', salesOpen: false })]).state).toBe('none');
  });
  it('legacy open doc without category/hosted still counts (back-compat)', () => {
    expect(ticketStatusFor('r', [ev('a', { raceId: 'r' })]).state).toBe('open');
  });
  it('a cup/club event never makes a race hosted', () => {
    expect(ticketStatusFor('r', [ev('a', { raceId: 'r', category: 'cup', hosted: true })]).state).toBe('none');
  });
  it('prefers the open event when several reference the race', () => {
    const t = ticketStatusFor('r', [
      ev('a', { raceId: 'r', hosted: true, salesOpen: false }),
      ev('b', { raceId: 'r' }),
    ]);
    expect(t.bookingEventId).toBe('b');
  });
  it('nextHostedRace skips Malaysia and returns Singapore', () => {
    const races = [
      race('2026-r16-malaysia', 16, '2026-10-04'),
      race('2026-r17-singapore', 17, '2026-10-11'),
      race('2026-r18', 18, '2026-10-25'),
    ];
    const events = [ev('sg', { raceId: '2026-r17-singapore', hosted: true, salesOpen: false })];
    expect(nextHostedRace(new Date('2026-10-02T00:00:00Z'), races, events)?.id).toBe('2026-r17-singapore');
    expect(nextHostedRace(new Date('2026-10-02T00:00:00Z'), races, [])).toBeNull();
    expect(nextHostedRace(new Date('2026-10-12T00:00:00Z'), races, events)).toBeNull();
  });
});

describe('categories, tabs, partition, All (R50)', () => {
  const now = new Date('2026-10-02T00:00:00Z');

  it('categoryOf defaults to f1 for legacy docs and unknown values', () => {
    expect(categoryOf(ev('a'))).toBe('f1');
    expect(categoryOf(ev('a', { category: 'cup' }))).toBe('cup');
    expect(categoryOf(ev('a', { category: 'club' }))).toBe('club');
    expect(categoryOf(ev('a', { category: 'zzz' as never }))).toBe('f1');
  });
  it('parseTab / defaultTab', () => {
    expect(parseTab('club')).toBe('club');
    expect(parseTab('nope')).toBeNull();
    expect(parseTab(null)).toBeNull();
    expect(defaultTab(true)).toBe('f1');
    expect(defaultTab(false)).toBe('all');
  });
  it('eventsInCategory filters by category and excludes unlisted', () => {
    const events = [
      ev('a'),
      ev('b', { category: 'cup' }),
      ev('c', { category: 'club', salesOpen: false, hosted: true }),
      ev('d', { category: 'club', salesOpen: false }),
    ];
    expect(eventsInCategory(events, 'cup').map((e) => e.id)).toEqual(['b']);
    expect(eventsInCategory(events, 'club').map((e) => e.id)).toEqual(['c']);
    expect(eventsInCategory(events, 'f1').map((e) => e.id)).toEqual(['a']);
  });
  it('partitionByTime: upcoming ascending, past descending, 6h grace', () => {
    const items = [
      ev('past1', { dateUtc: '2026-09-01T00:00:00Z' }),
      ev('later', { dateUtc: '2026-12-01T00:00:00Z' }),
      ev('soon', { dateUtc: '2026-10-05T00:00:00Z' }),
      ev('past2', { dateUtc: '2026-09-20T00:00:00Z' }),
      ev('tonight', { dateUtc: '2026-10-01T22:00:00Z' }),
    ];
    const p = partitionByTime(items, (e) => Date.parse(e.dateUtc), now);
    expect(p.upcoming.map((e) => e.id)).toEqual(['tonight', 'soon', 'later']);
    expect(p.past.map((e) => e.id)).toEqual(['past2', 'past1']);
  });
  it('standaloneEvents drops f1 events that map to a calendar race only', () => {
    const races = [race('r17', 17, '2026-10-11')];
    const events = [
      ev('sg', { raceId: 'r17' }),
      ev('f1x', { raceId: 'gone' }),
      ev('f1y'),
      ev('cup', { category: 'cup', raceId: 'r17' }),
    ];
    expect(standaloneEvents(events, races).map((e) => e.id)).toEqual(['f1x', 'f1y', 'cup']);
  });
  it('allItems: hosted races + all host events, Malaysia absent, no duplicates, chronological', () => {
    const races = [
      race('2026-r16-malaysia', 16, '2026-10-04'),
      race('2026-r17-singapore', 17, '2026-10-11'),
      race('x', 18, '2026-10-25', 'cancelled-by-host'),
    ];
    const events = [
      ev('sg', { raceId: '2026-r17-singapore', hosted: true, salesOpen: false }),
      ev('cup1', { category: 'cup', dateUtc: '2026-10-08T10:00:00Z' }),
      ev('club1', { category: 'club', dateUtc: '2026-10-30T10:00:00Z' }),
    ];
    const items = allItems(races, events);
    const sorted = [...items].sort((a, b) => a.startMs - b.startMs).map((i) => i.key);
    expect(sorted).toEqual(['event-cup1', 'race-2026-r17-singapore', 'event-club1']);
    expect(items.some((i) => i.key.includes('malaysia'))).toBe(false);
    expect(items.find((i) => i.kind === 'race' && i.ticket.state === 'soon')).toBeTruthy();
  });
  it('allItems with no events and no hosted races is empty', () => {
    expect(allItems([race('r', 1, '2026-10-04')], [])).toEqual([]);
  });
});
