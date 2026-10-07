/**
 * Pure track geometry for the circuit graphics (TrackMap runner, TrackLayout). No React, no DOM, so
 * every helper is unit-tested (trackGeometry.test.ts). Geometry only ever derives from the real
 * validated outlines / telemetry laps (R17): nothing here invents a shape or an elevation.
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
  let cmd = 'M';
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
      cmd = m[1].toUpperCase();
      if (cmd === 'Z' && first) {
        const f: Pt = first;
        const last = out[out.length - 1];
        if (!last || last.x !== f.x || last.y !== f.y) out.push({ x: f.x, y: f.y });
      }
    } else {
      nums.push(Number(m[2]));
    }
  }
  flush();
  void cmd;
  return out;
}

/** Cumulative arc length at each point (cum[0] = 0, cum[n-1] = total). */
export function cumulativeLengths(points: Pt[]): number[] {
  const cum = new Array<number>(points.length).fill(0);
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    cum[i] = cum[i - 1] + Math.hypot(dx, dy);
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

/** Linear interpolation of a per-point value at distance fraction f. */
export function valueAtFraction(values: number[], fracs: number[], f: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const i = segmentAt(fracs, Math.min(1, Math.max(0, f)));
  const span = fracs[i + 1] - fracs[i];
  const local = span > 0 ? Math.min(1, Math.max(0, (f - fracs[i]) / span)) : 0;
  return values[i] + (values[i + 1] - values[i]) * local;
}

/** Index of the point nearest to (x, y). */
export function nearestIndex(points: Pt[], x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = (points[i].x - x) ** 2 + (points[i].y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Straight-segment path through points. */
export function linePath(points: Pt[], closed = false): string {
  if (points.length === 0) return '';
  const body = points.map((p, i) => `${i ? 'L' : 'M'}${r1(p.x)} ${r1(p.y)}`).join(' ');
  return closed ? `${body} Z` : body;
}

/**
 * Smooth path through every point (uniform Catmull-Rom converted to cubic Beziers). `tension` 0..1:
 * 0 = straight lines, 1 = full Catmull-Rom. Always passes through the data points, so it never
 * invents a corner, only rounds the polyline between telemetry samples.
 */
export function smoothPath(points: Pt[], closed = false, tension = 1): string {
  const n = points.length;
  if (n < 3) return linePath(points, closed);
  const k = tension / 6;
  const at = (i: number): Pt => {
    if (closed) return points[(i + n) % n];
    return points[Math.min(n - 1, Math.max(0, i))];
  };
  let d = `M${r1(points[0].x)} ${r1(points[0].y)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) * k;
    const c1y = p1.y + (p2.y - p0.y) * k;
    const c2x = p2.x - (p3.x - p1.x) * k;
    const c2y = p2.y - (p3.y - p1.y) * k;
    d += ` C${r1(c1x)} ${r1(c1y)} ${r1(c2x)} ${r1(c2y)} ${r1(p2.x)} ${r1(p2.y)}`;
  }
  return closed ? `${d} Z` : d;
}

export interface FittedPoint extends Pt {
  /** Metres above the lowest point of the lap. */
  rel: number;
  /** Elevation normalised 0..1 over the lap (0.5 when flat). */
  k: number;
}

export interface FitOptions {
  width: number;
  height: number;
  pad: number;
}

/**
 * Fit an OpenF1 telemetry lap ([x, y, z] with z in decimetres, y up) into a box, preserving aspect
 * ratio and flipping y for SVG. Elevation is relative to the lowest point.
 */
export function fitProfile(pts: [number, number, number][], { width, height, pad }: FitOptions): FittedPoint[] {
  if (pts.length === 0) return [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, y, z] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const scale = Math.min((width - 2 * pad) / (maxX - minX || 1), (height - 2 * pad) / (maxY - minY || 1));
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const zRange = maxZ - minZ;
  return pts.map(([x, y, z]) => ({
    x: offX + (x - minX) * scale,
    y: height - (offY + (y - minY) * scale),
    rel: (z - minZ) / 10,
    k: zRange > 0 ? (z - minZ) / zRange : 0.5,
  }));
}

export interface RibbonOptions {
  /** Vertical squash of the ground plane (1 = top-down, ~0.6 = tilted). */
  squash: number;
  /** Pixels of lift per metre of elevation. */
  liftPerMetre: number;
  /** Cap on total lift in pixels. */
  maxLift: number;
  /** Box height, used to keep the squashed plane vertically centred. */
  height: number;
}

/** Lift per metre so the highest point rises at most maxLift px and a flat lap is not exaggerated. */
export function liftScale(elevRangeM: number, maxLift: number, maxPerMetre = 1.4): number {
  if (elevRangeM <= 0) return 0;
  return Math.min(maxPerMetre, maxLift / elevRangeM);
}

/**
 * Pseudo-3D projection: squash the ground plane around the box centre (a tilted view), then lift each
 * point by its real elevation. Returns the raised line and its ground shadow.
 */
export function projectRibbon(points: FittedPoint[], o: RibbonOptions): { line: Pt[]; ground: Pt[] } {
  const cy = o.height / 2;
  const ground = points.map((p) => ({ x: p.x, y: cy + (p.y - cy) * o.squash }));
  const line = points.map((p, i) => ({
    x: ground[i].x,
    y: ground[i].y - Math.min(o.maxLift, p.rel * o.liftPerMetre),
  }));
  return { line, ground };
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

/** Evenly resample a polyline to n points by distance (for light-weight runners and morphs). */
export function resample(points: Pt[], n: number): Pt[] {
  if (points.length < 2 || n < 2) return points.slice();
  const fracs = distanceFractions(points);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = pointAtFraction(points, fracs, i / (n - 1));
    out.push({ x: p.x, y: p.y });
  }
  return out;
}
