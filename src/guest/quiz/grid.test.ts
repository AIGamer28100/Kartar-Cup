import { describe, expect, it } from 'vitest';
import type { EventConfig, QuestionCfg } from '../../lib/types';
import { cardsFor, columnsOf, digitIndex, driverCode, gridMove, teamCode, teamColour } from './grid';

const cfg = {
  teams: [{ id: 'ferrari', label: 'Ferrari' }, { id: 'x', label: 'Red Bull Racing' }],
  drivers: [
    { id: 'b', label: 'LANDO NORRIS', teamId: 'x', grid: 2 },
    { id: 'a', label: 'Charles Leclerc', teamId: 'ferrari', grid: 1 },
  ],
} as unknown as EventConfig;
const q = (kind: QuestionCfg['kind']) => ({ id: 'q', prompt: 'p', kind }) as QuestionCfg;

describe('cardsFor', () => {
  it('yes/no', () => expect(cardsFor(cfg, q('yesno')).map((c) => c.code)).toEqual(['Y', 'N']));
  it('teams carry livery colour and initials', () => {
    const t = cardsFor(cfg, q('team'));
    expect(t[0].colour).toBe('#ED1131');
    expect(t[1].code).toBe('RB');
    expect(t[1].colour).toBe('#4781D7');
  });
  it('drivers sort by grid, title-case shouting names, show team', () => {
    const d = cardsFor(cfg, q('driver'));
    expect(d.map((c) => c.id)).toEqual(['a', 'b']);
    expect(d[1]).toMatchObject({ label: 'Lando Norris', first: 'Lando', main: 'Norris', sub: 'Red Bull Racing', code: 'NOR' });
  });
});

describe('colour and codes', () => {
  it('own hex wins; unknown is neutral', () => {
    expect(teamColour({ id: 'zzz', colour: 'abcdef' })).toBe('#ABCDEF');
    expect(teamColour({ id: 'zzz' })).toBe('#9AA6BD');
    expect(teamColour(undefined)).toBe('#9AA6BD');
  });
  it('codes', () => {
    expect(driverCode('Max Verstappen')).toBe('VER');
    expect(teamCode('Aston Martin')).toBe('AM');
    expect(teamCode('Williams')).toBe('WI');
  });
});

describe('keyboard', () => {
  it('gridMove', () => {
    expect(gridMove(0, 'ArrowRight', 6, 3)).toBe(1);
    expect(gridMove(0, 'ArrowLeft', 6, 3)).toBe(0);
    expect(gridMove(1, 'ArrowDown', 6, 3)).toBe(4);
    expect(gridMove(4, 'ArrowDown', 6, 3)).toBe(4);
    expect(gridMove(4, 'ArrowUp', 6, 3)).toBe(1);
    expect(gridMove(2, 'End', 6, 3)).toBe(5);
    expect(gridMove(2, 'x', 6, 3)).toBeNull();
    expect(gridMove(0, 'Home', 0, 3)).toBeNull();
  });
  it('digitIndex', () => {
    expect(digitIndex('1', 3)).toBe(0);
    expect(digitIndex('4', 3)).toBeNull();
    expect(digitIndex('0', 3)).toBeNull();
    expect(digitIndex('a', 3)).toBeNull();
  });
  it('columnsOf', () => {
    expect(columnsOf([])).toBe(1);
    expect(columnsOf([0, 0, 0, 90, 90])).toBe(3);
    expect(columnsOf([0, 80, 160])).toBe(1);
  });
});
