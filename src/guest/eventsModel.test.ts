import { describe, expect, it } from 'vitest';
import type { RaceInfo } from '../config/calendar';
import type { BookingEvent } from '../lib/types';
import { ticketStatusFor, upcomingRaces } from './eventsModel';

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
