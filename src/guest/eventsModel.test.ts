import { describe, expect, it } from 'vitest';
import type { RaceInfo } from '../config/calendar';
import type { BookingEvent } from '../lib/types';
import { groupByMonth, ticketStatusFor, upcomingRaces, upcomingSeasons } from './eventsModel';

const race = (
  id: string,
  round: number,
  raceDate: string,
  status: RaceInfo['status'] = 'scheduled',
  season: RaceInfo['season'] = 2026,
): RaceInfo => ({
  id,
  season,
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

describe('upcomingRaces', () => {
  it('drops past races and keeps the rest sorted by date', () => {
    const races = [
      race('a', 1, '2026-01-01'),
      race('b', 3, '2026-03-01'),
      race('c', 2, '2026-02-01'),
    ];
    const result = upcomingRaces(new Date('2026-01-15T00:00:00Z'), races);
    expect(result.map((r) => r.id)).toEqual(['c', 'b']);
  });

  it('excludes cancelled-by-host races', () => {
    const races = [race('a', 1, '2026-02-01', 'cancelled-by-host'), race('b', 2, '2026-03-01')];
    const result = upcomingRaces(new Date('2026-01-01T00:00:00Z'), races);
    expect(result.map((r) => r.id)).toEqual(['b']);
  });

  it('returns an empty list when nothing is left on the calendar', () => {
    const races = [race('a', 1, '2026-01-01')];
    expect(upcomingRaces(new Date('2027-01-01T00:00:00Z'), races)).toEqual([]);
  });

  it('defaults to the next race\'s season, not a flat multi-season dump', () => {
    const races = [
      race('a', 1, '2026-02-01', 'scheduled', 2026),
      race('b', 1, '2027-02-01', 'scheduled', 2027),
    ];
    const result = upcomingRaces(new Date('2026-01-01T00:00:00Z'), races);
    expect(result.map((r) => r.id)).toEqual(['a']);
  });

  it('returns a requested season explicitly, e.g. the next season on the selector', () => {
    const races = [
      race('a', 1, '2026-02-01', 'scheduled', 2026),
      race('b', 1, '2027-02-01', 'scheduled', 2027),
    ];
    const result = upcomingRaces(new Date('2026-01-01T00:00:00Z'), races, 2027);
    expect(result.map((r) => r.id)).toEqual(['b']);
  });
});

describe('upcomingSeasons', () => {
  it('lists only seasons that still have a race left, in order', () => {
    const races = [
      race('a', 1, '2026-02-01', 'scheduled', 2026),
      race('b', 1, '2027-02-01', 'scheduled', 2027),
    ];
    expect(upcomingSeasons(new Date('2026-01-01T00:00:00Z'), races)).toEqual([2026, 2027]);
  });

  it('is empty once the whole calendar is behind us', () => {
    const races = [race('a', 1, '2026-01-01', 'scheduled', 2026)];
    expect(upcomingSeasons(new Date('2027-01-01T00:00:00Z'), races)).toEqual([]);
  });
});

describe('groupByMonth', () => {
  it('groups consecutive same-month races under one label', () => {
    const races = [race('a', 1, '2026-10-04'), race('b', 2, '2026-10-18'), race('c', 3, '2026-11-01')];
    const groups = groupByMonth(races);
    expect(groups.map((g) => [g.label, g.races.map((r) => r.id)])).toEqual([
      ['October 2026', ['a', 'b']],
      ['November 2026', ['c']],
    ]);
  });
});

describe('ticketStatusFor', () => {
  const mkEvent = (raceId: string, id = raceId): BookingEvent =>
    ({ id, raceId, salesOpen: true } as unknown as BookingEvent);

  it('reports tickets available when a matching sales-open booking event exists', () => {
    const events = [mkEvent('2026-r15', 'evt-1')];
    expect(ticketStatusFor('2026-r15', events)).toEqual({ available: true, bookingEventId: 'evt-1' });
  });

  it('reports no tickets when no booking event references the race', () => {
    const events = [mkEvent('2026-r16', 'evt-2')];
    expect(ticketStatusFor('2026-r15', events)).toEqual({ available: false, bookingEventId: null });
  });

  it('reports no tickets when there are no booking events at all', () => {
    expect(ticketStatusFor('2026-r15', [])).toEqual({ available: false, bookingEventId: null });
  });
});
