import { describe, expect, it } from 'vitest';
import type { QuestionCfg } from '../../lib/types';
import type { AnswerCard } from './grid';
import { closesCopy, countAnswered, delayedHold, filterCards, lapLine, nextAfterPick, opensCopy, urgency } from './logic';

const ts = (ms: number) => ({ toMillis: () => ms });
const START = 1_000_000_000;
const raw = {
  raceStartUtc: ts(START),
  opensAt: ts(START - 10 * 60_000),
  closesAt: ts(START + 27 * 60_000),
  raceDurationMin: 90,
};
const base = raw as never;
const mk = (o: object) => ({ ...raw, ...o }) as never;

describe('copy', () => {
  it('opens', () => {
    expect(opensCopy(base)).toBe('Picks open 10 minutes before lights out.');
    expect(opensCopy(mk({ opensAt: ts(START - 60_000) }))).toBe('Picks open 1 minute before lights out.');
    expect(opensCopy(mk({ opensAt: ts(START) }))).toBe('Picks open at lights out.');
    expect(opensCopy(mk({ opensAt: ts(START + 60_000) }))).toBe('Picks open shortly after lights out.');
  });
  it('closes by laps, percent, clock, delay', () => {
    expect(closesCopy(mk({ totalLaps: 50 }))).toBe('Closes after lap 15 of 50, 30% of the race.');
    expect(closesCopy(base)).toBe('Closes when 30% of the race has run.');
    expect(closesCopy(mk({ closesAt: ts(START) }))).toBe('Closes at lights out.');
    expect(closesCopy(mk({ delayed: true }))).toBe('Race delayed. The quiz stays open until lights out.');
    expect(delayedHold(mk({ delayed: true, raceStartedAt: ts(START) }))).toBe(false);
  });
  it('lap line needs both numbers', () => {
    expect(lapLine({})).toBeNull();
    expect(lapLine({ totalLaps: 50, liveLap: 4 })).toBe('Lap 4 / 50 · closes after lap 15');
    expect(lapLine({ totalLaps: 50, liveLap: 99 })).toContain('Lap 50 / 50');
  });
});

describe('helpers', () => {
  const qs = [{ id: 'a' }, { id: 'b' }] as QuestionCfg[];
  it('urgency bands', () => {
    expect([urgency(30_000), urgency(200_000), urgency(600_000)]).toEqual(['final', 'soon', 'calm']);
  });
  it('counts answers', () => expect(countAnswered(qs, { a: 'x' })).toBe(1));
  it('next after pick', () => {
    expect(nextAfterPick(1, 5, false)).toBe(2);
    expect(nextAfterPick(4, 5, false)).toBe(5);
    expect(nextAfterPick(1, 5, true)).toBe(5);
  });
  it('filters cards', () => {
    const cards = [{ label: 'Max Verstappen', sub: 'Red Bull' }, { label: 'Lando Norris', sub: 'McLaren' }] as AnswerCard[];
    expect(filterCards(cards, '  ')).toHaveLength(2);
    expect(filterCards(cards, 'mclar')).toHaveLength(1);
  });
});
