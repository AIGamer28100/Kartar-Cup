import { describe, expect, it } from 'vitest';
import type { RaceInfo } from '../config/calendar';
import type { BookingEvent } from '../lib/types';
import { groupByMonth, previousRace, ticketStatusFor, timelineEntries, upcomingRaces, upcomingSeasons } from './eventsModel';

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

describe('timelineEntries', () => {
  it('marks the first entry with no gap', () => {
    const races = [race('r1', 1, '2027-03-14')];
    expect(timelineEntries(races)[0]).toMatchObject({ gapDays: null, longBreak: false, breakLabel: null });
  });

  it('does not flag a normal week-apart gap as a long break', () => {
    const races = [race('r1', 1, '2027-03-14'), race('r2', 2, '2027-03-21')];
    expect(timelineEntries(races)[1]).toMatchObject({ gapDays: 7, longBreak: false, breakLabel: null });
  });

  it('flags a gap over a week and labels it in days under 2 weeks', () => {
    const races = [race('r1', 1, '2027-03-14'), race('r2', 2, '2027-03-25')];
    expect(timelineEntries(races)[1]).toMatchObject({ gapDays: 11, longBreak: true, breakLabel: '11 day break' });
  });

  it('labels a gap of 2+ weeks in weeks', () => {
    const races = [race('r1', 1, '2027-03-14'), race('r2', 2, '2027-04-11')];
    expect(timelineEntries(races)[1]).toMatchObject({ gapDays: 28, longBreak: true, breakLabel: '4 week break' });
  });
});

describe('previousRace', () => {
  it('returns the most recent scheduled race before the next one', () => {
    const races = [
      race('r14', 14, '2026-09-13'),
      race('r15', 15, '2026-09-26', 'cancelled-by-host'),
      race('r16', 16, '2026-10-04'),
      race('r17', 17, '2026-10-11'),
    ];
    expect(previousRace(new Date('2026-09-27T00:00:00Z'), races)?.id).toBe('r14');
  });

  it('skips cancelled-by-host races, same rule as upcomingRaces', () => {
    const races = [
      race('r14', 14, '2026-09-01'),
      race('r15', 15, '2026-09-26', 'cancelled-by-host'),
      race('r16', 16, '2026-10-04'),
    ];
    expect(previousRace(new Date('2026-09-27T00:00:00Z'), races)?.id).toBe('r14');
  });

  it('returns null when there is no earlier scheduled race in the data', () => {
    const races = [race('r16', 16, '2026-10-04')];
    expect(previousRace(new Date('2026-09-27T00:00:00Z'), races)).toBeNull();
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
