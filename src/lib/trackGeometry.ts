/**
 * Pure 2D track geometry for the circuit graphics (TrackMap's lap runner, TrackLayout's sectors and
 * distances). No React, no DOM, so every helper is unit-tested (trackGeometry.test.ts). The 3D maths
 * lives in track3d.ts. Geometry only ever derives from the real validated outlines / telemetry laps
 * (R17): nothing here invents a shape.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Parse an absolute M/L/Z SVG path (the format of src/config/tracks/data) into points. A closing Z
 * appends the first point so the polyline is a full lap. */
export function parsePolylinePath(d: string): Pt[] {
  const out: Pt[] = [];
  const re = /([MLZmlz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  const nums: number[] = [];
  let first: Pt | null = null;
  const flush = () => {
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const p = { x: nums[i], y: nums[i + 1] };
      if (!first) first = p;
      out.push(p);
    }
    nums.length = 0;
  };
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    if (m[1]) {
      flush();
      if (m[1].toUpperCase() === 'Z' && first) {
        const f: Pt = first;
        const last = out[out.length - 1];
        if (!last || last.x !== f.x || last.y !== f.y) out.push({ x: f.x, y: f.y });
      }
    } else {
      nums.push(Number(m[2]));
    }
  }
  flush();
  return out;
}

/** Cumulative arc length at each point (cum[0] = 0, cum[n-1] = total). */
export function cumulativeLengths(points: Pt[]): number[] {
  const cum = new Array<number>(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    cum[i] = cum[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return cum;
}

/** Distance fraction (0..1) of every point along the polyline. */
export function distanceFractions(points: Pt[]): number[] {
  const cum = cumulativeLengths(points);
  const total = cum[cum.length - 1] || 1;
  return cum.map((c) => c / total);
}

/** Index i such that fracs[i] <= f < fracs[i+1] (binary search). */
export function segmentAt(fracs: number[], f: number): number {
  const n = fracs.length;
  if (n < 2) return 0;
  if (f <= fracs[0]) return 0;
  if (f >= fracs[n - 1]) return n - 2;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (fracs[mid] <= f) lo = mid;
    else hi = mid;
  }
  return lo;
}

export interface PointOnPath extends Pt {
  /** Heading in degrees (0 = +x, clockwise in SVG space). */
  angle: number;
  /** Segment start index. */
  index: number;
  /** 0..1 position inside the segment. */
  local: number;
}

/** Point at distance fraction f (0..1, wraps) along the polyline, with heading. */
export function pointAtFraction(points: Pt[], fracs: number[], f: number): PointOnPath {
  if (points.length === 0) return { x: 0, y: 0, angle: 0, index: 0, local: 0 };
  if (points.length === 1) return { ...points[0], angle: 0, index: 0, local: 0 };
  // Exactly 1 is the finish line (end of the lap); anything beyond wraps onto the next lap.
  const w = f === 1 ? 1 : f - Math.floor(f);
  const i = segmentAt(fracs, w);
  const a = points[i];
  const b = points[i + 1];
  const span = fracs[i + 1] - fracs[i];
  const local = span > 0 ? Math.min(1, Math.max(0, (w - fracs[i]) / span)) : 0;
  return {
    x: a.x + (b.x - a.x) * local,
    y: a.y + (b.y - a.y) * local,
    angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    index: i,
    local,
  };
}

/** Bounding box of a point set. */
export function bounds(points: Pt[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/** Which sector (0, 1, 2) a point index belongs to, given the indices where S1 and S2 end. */
export function sectorOfIndex(i: number, s1End: number, s2End: number): 0 | 1 | 2 {
  return i < s1End ? 0 : i < s2End ? 1 : 2;
}

/** Inclusive point ranges for the three sectors (adjacent sectors share their boundary point so the
 * drawn line is continuous). */
export function sectorRanges(n: number, s1End: number, s2End: number): [number, number][] {
  const a = Math.max(1, Math.min(n - 2, s1End));
  const b = Math.max(a + 1, Math.min(n - 1, s2End));
  return [
    [0, a],
    [a, b],
    [b, n - 1],
  ];
}
