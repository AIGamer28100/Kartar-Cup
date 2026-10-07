import { describe, expect, it } from 'vitest';
import { loadTrackProfile } from '../config/tracks/profiles';
import { TRACKS_BY_CIRCUIT } from '../config/tracks';
import {
  bounds,
  cumulativeLengths,
  distanceFractions,
  fitProfile,
  liftScale,
  linePath,
  nearestIndex,
  parsePolylinePath,
  pointAtFraction,
  projectRibbon,
  resample,
  sectorOfIndex,
  sectorRanges,
  segmentAt,
  smoothPath,
  valueAtFraction,
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
    // wraps
    expect(pointAtFraction(square, f, 1.125).x).toBeCloseTo(5);
    expect(pointAtFraction([], [], 0.5)).toMatchObject({ x: 0, y: 0 });
  });
  it('valueAtFraction interpolates per-point values', () => {
    const f = [0, 0.5, 1];
    expect(valueAtFraction([0, 10, 0], f, 0.25)).toBeCloseTo(5);
    expect(valueAtFraction([0, 10, 0], f, 0.5)).toBeCloseTo(10);
    expect(valueAtFraction([0, 10, 0], f, 2)).toBeCloseTo(0);
  });
  it('nearestIndex', () => {
    expect(nearestIndex(square, 9, 1)).toBe(1);
    expect(nearestIndex(square, 1, 9)).toBe(3);
  });
  it('resample spaces points evenly by distance', () => {
    const r = resample(square, 9);
    expect(r).toHaveLength(9);
    expect(r[1]).toEqual({ x: 5, y: 0 });
    expect(r[8]).toEqual({ x: 0, y: 0 });
  });
});

describe('paths', () => {
  it('linePath', () => {
    expect(linePath([{ x: 0, y: 0 }, { x: 1.26, y: 2 }])).toBe('M0 0 L1.3 2');
    expect(linePath([{ x: 0, y: 0 }, { x: 1, y: 1 }], true)).toBe('M0 0 L1 1 Z');
    expect(linePath([])).toBe('');
  });
  it('smoothPath passes through every point with one cubic per segment', () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 10, y: 5 },
      { x: 20, y: 0 },
      { x: 30, y: 5 },
    ];
    const d = smoothPath(pts);
    expect(d.startsWith('M0 0')).toBe(true);
    expect((d.match(/C/g) ?? []).length).toBe(3);
    for (const p of pts.slice(1)) expect(d).toContain(` ${p.x} ${p.y}`);
    expect(smoothPath(pts, true).endsWith('Z')).toBe(true);
    expect((smoothPath(pts, true).match(/C/g) ?? []).length).toBe(4);
  });
  it('smoothPath with tension 0 has control points on the chord ends', () => {
    const d = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }], false, 0);
    expect(d).toBe('M0 0 C0 0 10 0 10 0 C10 0 20 0 20 0');
  });
  it('falls back to straight lines for tiny inputs', () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBe('M0 0 L5 5');
  });
});

describe('fitProfile', () => {
  const pts: [number, number, number][] = [
    [0, 0, 100],
    [100, 0, 150],
    [100, 50, 200],
    [0, 50, 100],
  ];
  it('fits inside the padded box, flips y and keeps aspect', () => {
    const f = fitProfile(pts, { width: 640, height: 400, pad: 20 });
    const b = bounds(f);
    expect(b.minX).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(b.maxX).toBeLessThanOrEqual(620 + 1e-9);
    expect(b.minY).toBeGreaterThanOrEqual(20 - 1e-9);
    expect(b.maxY).toBeLessThanOrEqual(380 + 1e-9);
    // aspect 2:1 preserved
    expect((b.maxX - b.minX) / (b.maxY - b.minY)).toBeCloseTo(2);
    // y=0 (south) is drawn at the bottom
    expect(f[0].y).toBeGreaterThan(f[2].y);
  });
  it('elevation is metres above the lowest point', () => {
    const f = fitProfile(pts, { width: 640, height: 400, pad: 20 });
    expect(f.map((p) => p.rel)).toEqual([0, 5, 10, 0]);
    expect(f.map((p) => p.k)).toEqual([0, 0.5, 1, 0]);
  });
  it('flat lap gets k = 0.5 and no lift', () => {
    const flat = fitProfile([[0, 0, 10], [1, 1, 10], [2, 0, 10]], { width: 100, height: 100, pad: 0 });
    expect(flat.every((p) => p.k === 0.5 && p.rel === 0)).toBe(true);
    expect(fitProfile([], { width: 1, height: 1, pad: 0 })).toEqual([]);
  });
});

describe('pseudo-3D ribbon', () => {
  it('liftScale caps both total lift and per-metre exaggeration', () => {
    expect(liftScale(100, 30)).toBeCloseTo(0.3);
    expect(liftScale(5, 30)).toBe(1.4);
    expect(liftScale(0, 30)).toBe(0);
  });
  it('squashes around the centre and lifts by elevation', () => {
    const pts = [
      { x: 0, y: 0, rel: 0, k: 0 },
      { x: 10, y: 100, rel: 10, k: 1 },
    ];
    const { line, ground } = projectRibbon(pts, { squash: 0.5, liftPerMetre: 2, maxLift: 15, height: 100 });
    expect(ground[0]).toEqual({ x: 0, y: 25 });
    expect(ground[1]).toEqual({ x: 10, y: 75 });
    expect(line[0]).toEqual({ x: 0, y: 25 });
    expect(line[1]).toEqual({ x: 10, y: 60 }); // 10 m * 2 = 20, capped at 15
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
    // degenerate boundaries stay valid
    const r = sectorRanges(5, 0, 0);
    expect(r[0][0]).toBe(0);
    expect(r[2][1]).toBe(4);
    for (const [a, b] of r) expect(b).toBeGreaterThan(a);
  });
  it('works on a real telemetry lap', async () => {
    const p = await loadTrackProfile(61);
    expect(p).not.toBeNull();
    const f = fitProfile(p!.pts, { width: 640, height: 400, pad: 30 });
    const fr = distanceFractions(f);
    expect(fr[0]).toBe(0);
    expect(fr[fr.length - 1]).toBe(1);
    expect(fr[p!.s1End]).toBeGreaterThan(0.1);
    expect(fr[p!.s2End]).toBeLessThan(0.95);
  });
});
