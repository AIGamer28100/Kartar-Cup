import { describe, expect, it } from 'vitest';
import { loadTrackProfile } from '../config/tracks/profiles';
import { TRACKS_BY_CIRCUIT } from '../config/tracks';
import {
  bounds,
  cumulativeLengths,
  distanceFractions,
  parsePolylinePath,
  pointAtFraction,
  sectorOfIndex,
  sectorRanges,
  segmentAt,
} from './trackGeometry';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
  { x: 0, y: 0 },
];

describe('parsePolylinePath', () => {
  it('reads absolute M/L and closes on Z', () => {
    expect(parsePolylinePath('M0 0 L10 0 L10 10 Z')).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 0 },
    ]);
  });
  it('accepts commas, decimals and negatives', () => {
    expect(parsePolylinePath('M-1.5,2 L3.25,-4')).toEqual([
      { x: -1.5, y: 2 },
      { x: 3.25, y: -4 },
    ]);
  });
  it('parses every real circuit outline into a usable polyline', () => {
    for (const t of Object.values(TRACKS_BY_CIRCUIT)) {
      const pts = parsePolylinePath(t.d);
      expect(pts.length).toBeGreaterThan(20);
      const b = bounds(pts);
      expect(b.minX).toBeGreaterThanOrEqual(-1);
      expect(b.maxX).toBeLessThanOrEqual(1001);
      for (const p of pts) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('lengths and fractions', () => {
  it('cumulative lengths of a square', () => {
    expect(cumulativeLengths(square)).toEqual([0, 10, 20, 30, 40]);
    expect(distanceFractions(square)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
  it('segmentAt finds the containing segment', () => {
    const f = [0, 0.25, 0.5, 0.75, 1];
    expect(segmentAt(f, 0)).toBe(0);
    expect(segmentAt(f, 0.3)).toBe(1);
    expect(segmentAt(f, 0.75)).toBe(3);
    expect(segmentAt(f, 1)).toBe(3);
    expect(segmentAt(f, -1)).toBe(0);
    expect(segmentAt([0], 0.5)).toBe(0);
  });
  it('pointAtFraction interpolates position and heading', () => {
    const f = distanceFractions(square);
    expect(pointAtFraction(square, f, 0.125)).toMatchObject({ x: 5, y: 0, angle: 0, index: 0 });
    const p = pointAtFraction(square, f, 0.375);
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(5);
    expect(p.angle).toBeCloseTo(90);
    expect(pointAtFraction(square, f, 1)).toMatchObject({ x: 0, y: 0 });
    // wraps onto the next lap
    expect(pointAtFraction(square, f, 1.125).x).toBeCloseTo(5);
    expect(pointAtFraction([], [], 0.5)).toMatchObject({ x: 0, y: 0 });
  });
  it('the runner on a real outline ends where it starts (closed lap)', () => {
    const pts = parsePolylinePath(TRACKS_BY_CIRCUIT['marina-bay'].d);
    const f = distanceFractions(pts);
    const a = pointAtFraction(pts, f, 0);
    const b = pointAtFraction(pts, f, 1);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y).toBeCloseTo(a.y);
  });
});

describe('sectors', () => {
  it('sectorOfIndex', () => {
    expect(sectorOfIndex(0, 10, 20)).toBe(0);
    expect(sectorOfIndex(10, 10, 20)).toBe(1);
    expect(sectorOfIndex(25, 10, 20)).toBe(2);
  });
  it('sectorRanges are contiguous and cover the lap', () => {
    expect(sectorRanges(30, 10, 20)).toEqual([
      [0, 10],
      [10, 20],
      [20, 29],
    ]);
    const r = sectorRanges(5, 0, 0);
    expect(r[0][0]).toBe(0);
    expect(r[2][1]).toBe(4);
    for (const [a, b] of r) expect(b).toBeGreaterThan(a);
  });
  it('works on a real telemetry lap', async () => {
    const p = await loadTrackProfile(61);
    expect(p).not.toBeNull();
    const pts = p!.pts.map(([x, y]) => ({ x, y }));
    const fr = distanceFractions(pts);
    expect(fr[0]).toBe(0);
    expect(fr[fr.length - 1]).toBe(1);
    expect(fr[p!.s1End]).toBeGreaterThan(0.1);
    expect(fr[p!.s2End]).toBeLessThan(0.95);
  });
});
