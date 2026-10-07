import { describe, expect, it } from 'vitest';
import { loadTrackProfile } from '../config/tracks/profiles';
import {
  chunkRanges,
  clampPitch,
  climbStats,
  decay,
  depthOrder,
  easeFit,
  fitBounds,
  fitViewport,
  hysteresis,
  makeCamera,
  normalizeTrack,
  PITCH_MAX,
  PITCH_MIN,
  project,
  toScreen,
  wrapYaw,
  yawDelta,
  Z_MAX,
  Z_MIN,
} from './track3d';

const square: [number, number, number][] = [
  [0, 0, 100],
  [100, 0, 150],
  [100, 100, 200],
  [0, 100, 100],
];

describe('normalizeTrack', () => {
  it('centres the lap with plan radius 1 and keeps real relative heights', () => {
    const w = normalizeTrack(square);
    const r = Math.max(...w.pts.map((p) => Math.hypot(p.x, p.y)));
    expect(r).toBeCloseTo(1);
    const cx = w.pts.reduce((a, p) => a + p.x, 0) / w.pts.length;
    expect(cx).toBeCloseTo(0);
    expect(w.rel).toEqual([0, 5, 10, 0]);
    expect(w.maxRel).toBe(10);
    // z is proportional to elevation and peaks at zMax
    expect(w.pts[2].z).toBeCloseTo(w.zMax);
    expect(w.pts[1].z).toBeCloseTo(w.zMax / 2);
    expect(w.pts[0].z).toBe(0);
  });
  it('normalises height: a hillier lap is taller, but a flat-ish one still reads', () => {
    const small = normalizeTrack(square); // 10 m
    const big = normalizeTrack(square.map(([x, y, z]) => [x, y, z * 5] as [number, number, number])); // far more
    expect(small.zMax).toBeGreaterThanOrEqual(Z_MIN);
    expect(big.zMax).toBeGreaterThan(small.zMax);
    expect(big.zMax).toBeLessThanOrEqual(Z_MAX + 1e-9);
  });
  it('flat and empty laps', () => {
    const flat = normalizeTrack([
      [0, 0, 5],
      [1, 0, 5],
      [1, 1, 5],
    ]);
    expect(flat.zMax).toBe(0);
    expect(flat.pts.every((p) => p.z === 0)).toBe(true);
    expect(normalizeTrack([]).pts).toEqual([]);
  });
  it('reports plan scale only with a known lap length', () => {
    expect(normalizeTrack(square).planPerMetre).toBeNull();
    expect(normalizeTrack(square, 0.4)!.planPerMetre).toBeGreaterThan(0);
  });
});

describe('camera projection', () => {
  it('looking straight down shows the plan (north up) and nearer = higher', () => {
    const c = makeCamera(0, 90, 3);
    const north = project({ x: 0, y: 1, z: 0 }, c);
    const east = project({ x: 1, y: 0, z: 0 }, c);
    expect(north.y).toBeGreaterThan(0);
    expect(Math.abs(north.x)).toBeLessThan(1e-9);
    expect(east.x).toBeGreaterThan(0);
    const low = project({ x: 0, y: 0, z: 0 }, c);
    const high = project({ x: 0, y: 0, z: 0.2 }, c);
    expect(high.depth).toBeLessThan(low.depth);
  });
  it('a tilted camera sees the far side higher on screen and farther away', () => {
    const c = makeCamera(0, 55, 3.2);
    const near = project({ x: 0, y: -1, z: 0 }, c);
    const far = project({ x: 0, y: 1, z: 0 }, c);
    expect(far.y).toBeGreaterThan(near.y);
    expect(far.depth).toBeGreaterThan(near.depth);
    // perspective: the far side is drawn smaller
    const farW = project({ x: 0.5, y: 1, z: 0 }, c).x;
    const nearW = project({ x: 0.5, y: -1, z: 0 }, c).x;
    expect(farW).toBeLessThan(nearW);
  });
  it('raising a point lifts it on screen', () => {
    const c = makeCamera(30, 55);
    expect(project({ x: 0.3, y: 0.2, z: 0.1 }, c).y).toBeGreaterThan(project({ x: 0.3, y: 0.2, z: 0 }, c).y);
  });
  it('yaw rotates the circuit around the vertical axis', () => {
    const p = { x: 1, y: 0, z: 0 };
    const a = project(p, makeCamera(0, 90));
    const b = project(p, makeCamera(90, 90));
    expect(a.x).toBeGreaterThan(0.5);
    expect(Math.abs(b.x)).toBeLessThan(1e-9);
  });
});

describe('depth sorting', () => {
  it('orders far to near', () => {
    expect(depthOrder([1, 3, 2])).toEqual([1, 2, 0]);
  });
  it('a bridge (higher) draws over an underpass at equal depth', () => {
    expect(depthOrder([2, 2], [0.5, 0.1])).toEqual([1, 0]);
    expect(depthOrder([2, 2], [0.1, 0.5])).toEqual([0, 1]);
  });
  it('the higher crossing segment is nearer the camera and so draws last', () => {
    const c = makeCamera(20, 55);
    const under = project({ x: 0, y: 0, z: 0 }, c).depth;
    const over = project({ x: 0, y: 0, z: 0.15 }, c).depth;
    const order = depthOrder([under, over]);
    expect(order[order.length - 1]).toBe(1);
  });
  it('chunkRanges shares boundaries and covers the lap', () => {
    expect(chunkRanges(8, 3)).toEqual([
      [0, 3],
      [3, 6],
      [6, 7],
    ]);
    expect(chunkRanges(1, 3)).toEqual([]);
  });
});

describe('viewport fitting', () => {
  it('fits every yaw inside the viewport', async () => {
    const prof = await loadTrackProfile(9);
    const w = normalizeTrack(prof!.pts);
    const fit = fitViewport(w.pts, 55, 3.2, w.zMax / 2, 600, 400);
    for (const yaw of [0, 45, 137, 270]) {
      const c = makeCamera(yaw, 55, 3.2, w.zMax / 2);
      for (const p of w.pts) {
        const s = toScreen(project(p, c), fit, 600, 400);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(600);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(400);
      }
    }
  });
  it('degenerate inputs', () => {
    expect(fitViewport([], 55, 3, 0, 100, 100)).toEqual({ scale: 1, cx: 0, cy: 0 });
    expect(fitBounds([], 100, 100)).toEqual({ scale: 1, cx: 0, cy: 0 });
  });
  it('fitBounds frames the current view with padding', () => {
    const f = fitBounds([{ x: -1, y: -0.5 }, { x: 1, y: 0.5 }], 400, 400, 0.1);
    expect(f).toEqual({ scale: 160, cx: 0, cy: 0 });
    const s = toScreen({ x: 1, y: 0.5, depth: 1 }, f, 400, 400);
    expect(s).toEqual({ x: 360, y: 120 });
  });
  it('easeFit glides toward the target, frame-rate independent', () => {
    const a = { scale: 100, cx: 0, cy: 0 };
    const b = { scale: 200, cx: 1, cy: -1 };
    const half = easeFit(a, b, 140 * Math.LN2, 140);
    expect(half.scale).toBeCloseTo(150);
    const twoSteps = easeFit(easeFit(a, b, 10), b, 10);
    expect(twoSteps.scale).toBeCloseTo(easeFit(a, b, 20).scale);
    expect(easeFit(a, b, 1e6)).toEqual(b);
  });
});

describe('camera input helpers', () => {
  it('clamps pitch and wraps yaw', () => {
    expect(clampPitch(10)).toBe(PITCH_MIN);
    expect(clampPitch(95)).toBe(PITCH_MAX);
    expect(clampPitch(55)).toBe(55);
    expect(wrapYaw(190)).toBe(-170);
    expect(wrapYaw(-190)).toBe(170);
    expect(wrapYaw(720)).toBe(0);
    expect(yawDelta(170, -170)).toBe(20);
  });
  it('inertia decays by half every half-life, independent of frame rate', () => {
    expect(decay(1, 160, 160)).toBeCloseTo(0.5);
    const twoSteps = decay(decay(1, 8, 160), 8, 160);
    expect(twoSteps).toBeCloseTo(decay(1, 16, 160));
  });
});

describe('elevation statistics', () => {
  it('hysteresis ignores jitter inside the band', () => {
    expect(hysteresis([0, 0.2, -0.2, 0.1], 0.5)).toEqual([0, 0, 0, 0]);
    const h = hysteresis([0, 2, 2.2, 1], 0.5);
    [0, 1.5, 1.7, 1.5].forEach((v, i) => expect(h[i]).toBeCloseTo(v));
  });
  it('climb stats on a simple profile', () => {
    const s = climbStats([0, 1, 3, 2, 2, 6, 5, 0], 0);
    expect(s.lowIndex).toBe(0);
    expect(s.highIndex).toBe(5);
    expect(s.range).toBe(6);
    expect(s.totalClimb).toBe(3 + 4);
    expect(s.biggestRise).toEqual({ metres: 4, from: 3, to: 5 });
  });
  it('jitter does not inflate the total climb', () => {
    const noisy = Array.from({ length: 200 }, (_, i) => (i % 2 ? 0.1 : -0.1));
    expect(climbStats(noisy, 0.4).totalClimb).toBe(0);
  });
  it('empty input', () => {
    expect(climbStats([]).totalClimb).toBe(0);
  });
  it('real laps give sensible numbers', async () => {
    const cota = await loadTrackProfile(9);
    const s = climbStats(normalizeTrack(cota!.pts).rel);
    expect(s.range).toBeGreaterThan(20);
    expect(s.totalClimb).toBeGreaterThanOrEqual(s.biggestRise.metres);
    expect(s.biggestRise.metres).toBeGreaterThan(5);
  });
});
