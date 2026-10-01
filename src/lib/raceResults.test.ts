import { describe, expect, it } from 'vitest';
import { deriveRaceFacts, factForPrompt, mapFactsToQuestions, type RawRaceData } from './raceResults';

const drivers = [
  { driver_number: 1, full_name: 'Max Verstappen', team_name: 'Red Bull Racing' },
  { driver_number: 4, full_name: 'Lando Norris', team_name: 'McLaren' },
  { driver_number: 81, full_name: 'Oscar Piastri', team_name: 'McLaren' },
  { driver_number: 44, full_name: 'Lewis Hamilton', team_name: 'Ferrari' },
];

const base = (): RawRaceData => ({
  drivers,
  sessionResult: [
    { driver_number: 1 },
    { driver_number: 4 },
    { driver_number: 81, dnf: true },
    { driver_number: 44 },
  ],
  pits: [
    { driver_number: 1, stop_duration: 2.4 },
    { driver_number: 4, stop_duration: 2.1 },
    { driver_number: 81, stop_duration: 11.4 },
    { driver_number: 44, stop_duration: 3.0 },
  ],
  overtakes: [
    { overtaking_driver_number: 1 },
    { overtaking_driver_number: 1 },
    { overtaking_driver_number: 44 },
  ],
  laps: [
    { driver_number: 1, lap_duration: 81.2 },
    { driver_number: 4, lap_duration: 80.5 },
    { driver_number: 4, lap_duration: null },
    { driver_number: 44, lap_duration: 80.9 },
  ],
});

describe('deriveRaceFacts', () => {
  it('derives each fact, slugging ids the same way the lineup does', () => {
    const f = deriveRaceFacts(base());
    expect(f.slowestPitTeams).toEqual(['mclaren']); // Piastri's 11.4s
    expect(f.fastestPitTeams).toEqual(['mclaren']); // Norris's 2.1s
    expect(f.mostOvertakeDrivers).toEqual(['max-verstappen']);
    expect(f.dnfDrivers).toEqual(['oscar-piastri']);
    expect(f.fastestLapDrivers).toEqual(['lando-norris']);
    expect(f.notes).toEqual([]);
  });

  it('keeps every tied id and says so', () => {
    const raw = base();
    raw.overtakes = [{ overtaking_driver_number: 1 }, { overtaking_driver_number: 44 }];
    const f = deriveRaceFacts(raw);
    expect(f.mostOvertakeDrivers.sort()).toEqual(['lewis-hamilton', 'max-verstappen']);
    expect(f.notes.join(' ')).toMatch(/Tie for most overtakes/);
  });

  it('leaves DNF empty and notes it when nobody retired', () => {
    const raw = base();
    raw.sessionResult = raw.sessionResult.map((r) => ({ ...r, dnf: false }));
    const f = deriveRaceFacts(raw);
    expect(f.dnfDrivers).toEqual([]);
    expect(f.notes.join(' ')).toMatch(/Nobody retired/);
  });

  it('falls back to pit-lane time only when no stationary times exist, and says so', () => {
    const raw = base();
    raw.pits = [
      { driver_number: 1, lane_duration: 22.5 },
      { driver_number: 44, lane_duration: 21.0 },
    ];
    const f = deriveRaceFacts(raw);
    expect(f.slowestPitTeams).toEqual(['red-bull-racing']);
    expect(f.fastestPitTeams).toEqual(['ferrari']);
    expect(f.notes.join(' ')).toMatch(/pit-lane time/);
  });

  it('says "couldn\'t load" (not "no data") when a dataset errored, e.g. rate limited', () => {
    const raw = base();
    raw.pits = [];
    raw.failed = ['pit'];
    const f = deriveRaceFacts(raw);
    expect(f.notes.join(' ')).toMatch(/Couldn't load pit stop data/);
    expect(f.notes.join(' ')).not.toMatch(/has no pit stop data/);
  });

  it('reports missing datasets instead of inventing answers', () => {
    const f = deriveRaceFacts({ drivers, sessionResult: [], pits: [], overtakes: [], laps: [] });
    expect(f.slowestPitTeams).toEqual([]);
    expect(f.fastestLapDrivers).toEqual([]);
    expect(f.notes.length).toBeGreaterThanOrEqual(4);
  });
});

describe('factForPrompt', () => {
  it('matches the default quiz prompts, testing fastest-pit before fastest-lap', () => {
    expect(factForPrompt('Which constructor has the SLOWEST pit stop?')).toBe('slowestPitTeams');
    expect(factForPrompt('Which constructor has the FASTEST pit stop?')).toBe('fastestPitTeams');
    expect(factForPrompt('Which driver sets the FASTEST LAP?')).toBe('fastestLapDrivers');
    expect(factForPrompt('Which driver makes the MOST overtakes?')).toBe('mostOvertakeDrivers');
    expect(factForPrompt('Which driver will DNF?')).toBe('dnfDrivers');
  });
  it('returns null for a custom question it cannot answer', () => {
    expect(factForPrompt('Who wins the podium shoey?')).toBeNull();
  });
});

describe('mapFactsToQuestions', () => {
  const facts = deriveRaceFacts(base());
  const valid = {
    team: new Set(['mclaren', 'ferrari']),
    driver: new Set(['max-verstappen', 'lando-norris', 'oscar-piastri', 'lewis-hamilton']),
  };

  it('fills matched questions by question id and skips unknown ones', () => {
    const out = mapFactsToQuestions(
      facts,
      [
        { id: 'q1', kind: 'team', prompt: 'Which constructor has the SLOWEST pit stop?' },
        { id: 'q3', kind: 'driver', prompt: 'Which driver will DNF?' },
        { id: 'q9', kind: 'driver', prompt: 'Who wins the podium shoey?' },
      ],
      valid,
    );
    expect(out.answers).toEqual({ q1: ['mclaren'], q3: ['oscar-piastri'] });
    expect(out.skipped).toHaveLength(1);
  });

  it('does not fill an answer whose id is not in the event lineup (old template ids)', () => {
    const out = mapFactsToQuestions(
      facts,
      [{ id: 'q5', kind: 'driver', prompt: 'Which driver sets the FASTEST LAP?' }],
      { team: new Set(), driver: new Set(['norris']) },
    );
    expect(out.answers).toEqual({});
    expect(out.skipped[0]).toMatch(/isn't in this event's lineup/);
  });

  it('fills an empty (voided) answer when the fact is genuinely empty', () => {
    const none = deriveRaceFacts({ ...base(), sessionResult: base().sessionResult.map((r) => ({ ...r, dnf: false })) });
    const out = mapFactsToQuestions(none, [{ id: 'q3', kind: 'driver', prompt: 'Which driver will DNF?' }], valid);
    expect(out.answers).toEqual({ q3: [] });
  });
});
