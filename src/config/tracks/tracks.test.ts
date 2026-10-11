import { describe, expect, it } from 'vitest';
import { ALL_RACES } from '../calendar';
import { TRACKS_BY_CIRCUIT, TRACK_COVERAGE, trackForRace } from './index';

function parse(d: string) {
  const tokens = d.trim().split(/\s+/);
  const pts: [number, number][] = [];
  const cmds: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    const m = /^([MLZ])(.*)$/.exec(t);
    if (!m) throw new Error(`bad token ${t}`);
    cmds.push(m[1]);
    if (m[1] === 'Z') { i++; continue; }
    const x = Number(m[2] === '' ? tokens[++i] : m[2]);
    const y = Number(tokens[++i]);
    pts.push([x, y]);
    i++;
  }
  return { cmds, pts };
}

describe('tracks', () => {
  const all = Object.values(TRACKS_BY_CIRCUIT);

  it('has unique ids matching their keys', () => {
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    for (const [k, t] of Object.entries(TRACKS_BY_CIRCUIT)) expect(t.id).toBe(k);
  });

  it.each(all.map((t) => [t.id, t] as const))('%s path is valid, closed, in viewBox', (_id, t) => {
    const { cmds, pts } = parse(t.d);
    expect(cmds[0]).toBe('M');
    expect(cmds[cmds.length - 1]).toBe('Z');
    expect(cmds.slice(1, -1).every((c) => c === 'L')).toBe(true);
    expect(pts.length).toBeGreaterThanOrEqual(50);
    const [, , w, h] = t.viewBox.split(' ').map(Number);
    for (const [x, y] of pts) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(w);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(h);
    }
  });

  it('2026 R16 (Bahrain GP in Malaysia) is Sepang', () => {
    const t = trackForRace('2026-r16-malaysia');
    expect(t?.id).toBe('sepang');
    expect(t?.name).toBe('Sepang International Circuit');
  });

  it('every calendar race is mapped to data or listed unavailable with a reason', () => {
    for (const race of ALL_RACES) {
      const c = TRACK_COVERAGE.find((x) => x.raceId === race.id);
      expect(c, race.id).toBeDefined();
      if (c!.status === 'available') {
        expect(trackForRace(race.id), race.id).not.toBeNull();
      } else {
        expect(c!.reason, race.id).toBeTruthy();
        expect(trackForRace(race.id)).toBeNull();
      }
    }
  });

  it('returns null for unknown races', () => {
    expect(trackForRace('nope')).toBeNull();
  });
});
