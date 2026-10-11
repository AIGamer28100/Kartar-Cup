import { describe, expect, it } from 'vitest';
import { nextSession, raceStartFor, parseConstructorStandings, parseDriverStandings, parseSchedule, raceStartMs } from './f1api';

// Shape copied from the real https://api.jolpi.ca/ergast/f1/2026.json response (round 16).
const season = {
  MRData: {
    RaceTable: {
      Races: [
        {
          round: '16',
          date: '2026-10-04',
          time: '07:00:00Z',
          FirstPractice: { date: '2026-10-02', time: '04:30:00Z' },
          SecondPractice: { date: '2026-10-02', time: '08:00:00Z' },
          ThirdPractice: { date: '2026-10-03', time: '04:30:00Z' },
          Qualifying: { date: '2026-10-03', time: '08:00:00Z' },
        },
        {
          round: '17',
          date: '2026-10-11',
          time: '12:00:00Z',
          FirstPractice: { date: '2026-10-09', time: '09:30:00Z' },
          SprintQualifying: { date: '2026-10-09', time: '13:30:00Z' },
          Sprint: { date: '2026-10-10', time: '09:00:00Z' },
          Qualifying: { date: '2026-10-10', time: '13:00:00Z' },
        },
        { round: '18', date: 'not-a-date' },
      ],
    },
  },
};

describe('parseSchedule', () => {
  const s = parseSchedule(season);

  it('lists every session in running order, ending with the race', () => {
    expect(s.get(16)!.map((x) => x.key)).toEqual(['fp1', 'fp2', 'fp3', 'quali', 'race']);
    expect(s.get(16)!.at(-1)!.startMs).toBe(Date.parse('2026-10-04T07:00:00Z'));
  });

  it('handles a sprint weekend and sorts by time, not by field order', () => {
    expect(s.get(17)!.map((x) => x.key)).toEqual(['fp1', 'sprintQuali', 'sprint', 'quali', 'race']);
  });

  it('drops rounds with no usable times instead of inventing any', () => {
    expect(s.has(18)).toBe(false);
  });

  it('returns an empty map for junk input', () => {
    expect(parseSchedule(null).size).toBe(0);
    expect(parseSchedule({}).size).toBe(0);
  });
});

describe('raceStartMs / nextSession', () => {
  const sessions = parseSchedule(season).get(16)!;
  it('finds the real lights-out time (07:00Z, not a default)', () => {
    expect(raceStartMs(sessions)).toBe(Date.parse('2026-10-04T07:00:00Z'));
    expect(raceStartMs(undefined)).toBeNull();
  });
  it('picks the first session still to come', () => {
    expect(nextSession(sessions, Date.parse('2026-10-02T05:00:00Z'))!.key).toBe('fp2');
    expect(nextSession(sessions, Date.parse('2026-10-03T09:00:00Z'))!.key).toBe('race');
  });
  it('is null once the weekend is over', () => {
    expect(nextSession(sessions, Date.parse('2026-10-05T00:00:00Z'))).toBeNull();
  });
});

describe('standings parsers', () => {
  const drivers = {
    MRData: {
      StandingsTable: {
        StandingsLists: [
          {
            round: '15',
            DriverStandings: [
              {
                position: '1', points: '302', wins: '8',
                Driver: { givenName: 'Andrea Kimi', familyName: 'Antonelli' },
                Constructors: [{ name: 'Mercedes' }],
              },
              {
                position: '2', points: '236', wins: '3',
                Driver: { givenName: 'George', familyName: 'Russell' },
                Constructors: [{ name: 'Mercedes' }],
              },
            ],
          },
        ],
      },
    },
  };
  const constructors = {
    MRData: {
      StandingsTable: {
        StandingsLists: [
          { round: '15', ConstructorStandings: [{ position: '1', points: '538', wins: '11', Constructor: { name: 'Mercedes' } }] },
        ],
      },
    },
  };

  it('parses drivers with team, points and wins', () => {
    const d = parseDriverStandings(drivers)!;
    expect(d.round).toBe(15);
    expect(d.rows[0]).toEqual({ position: 1, name: 'Andrea Kimi Antonelli', team: 'Mercedes', points: 302, wins: 8 });
    expect(d.rows).toHaveLength(2);
  });
  it('parses constructors', () => {
    expect(parseConstructorStandings(constructors)!.rows[0]).toMatchObject({ name: 'Mercedes', points: 538, wins: 11 });
  });
  it('returns null when the season has no standings yet', () => {
    expect(parseDriverStandings({ MRData: { StandingsTable: { StandingsLists: [] } } })).toBeNull();
    expect(parseDriverStandings(undefined)).toBeNull();
  });
});

describe('raceStartFor', () => {
  const schedule = parseSchedule(season);
  it('uses the real lights-out when the schedule has the round', () => {
    expect(raceStartFor({ round: 16, raceDate: '2026-10-04' }, schedule)).toEqual({
      ms: Date.parse('2026-10-04T07:00:00Z'),
      exact: true,
    });
  });
  it('falls back to the dated default, flagged inexact, when it does not', () => {
    expect(raceStartFor({ round: 99, raceDate: '2027-03-14' }, schedule)).toEqual({
      ms: Date.parse('2027-03-14T13:00:00Z'),
      exact: false,
    });
    expect(raceStartFor({ round: 16, raceDate: '2026-10-04' }, null).exact).toBe(false);
  });
});
