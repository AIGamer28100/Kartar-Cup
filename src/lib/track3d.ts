/**
 * Pure 3D maths for the race page's circuit view (TrackLayout): world normalisation, an orbit
 * camera with perspective projection, depth sorting, viewport fitting, camera input helpers and
 * elevation statistics. No React, no DOM; every function is unit-tested (track3d.test.ts).
 * All geometry comes from the real telemetry lap (R17); elevation is only scaled, never invented.
 */

export interface P3 {
  x: number;
  y: number;
  z: number;
}

export interface World {
  /** Track points, centred, plan radius 1, z up (exaggerated for readability). */
  pts: P3[];
  /** Metres above the lowest point of the lap, per point. */
  rel: number[];
  /** Highest point, metres above the lowest. */
  maxRel: number;
  /** World z per metre of real elevation. */
  zPerMetre: number;
  /** World units per metre in plan (so zPerMetre / planPerMetre = vertical exaggeration). */
  planPerMetre: number | null;
  /** Height of the highest point in world units. */
  zMax: number;
}

/** Height of the highest point in world units (plan radius 1): from Z_MIN for a nearly flat lap up
 * to Z_MAX for 40 m or more of relief. */
export const Z_MIN = 0.1;
export const Z_MAX = 0.26;

/**
 * Centre a telemetry lap ([x, y, z], y north, z in decimetres) on the origin with plan radius 1.
 * Height is normalised so every circuit reads (a 5 m street circuit still shows relief) while
 * hillier circuits stay visibly taller: zMax = Z_MIN .. Z_MAX of the radius depending on the real
 * range. `lengthKm` (official lap length) lets callers state the exaggeration honestly.
 */
export function normalizeTrack(raw: [number, number, number][], lengthKm?: number): World {
  if (raw.length === 0) return { pts: [], rel: [], maxRel: 0, zPerMetre: 0, planPerMetre: null, zMax: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, y, z] of raw) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  let r = 0;
  for (const [x, y] of raw) r = Math.max(r, Math.hypot(x - cx, y - cy));
  r = r || 1;
  const rel = raw.map(([, , z]) => (z - minZ) / 10);
  const maxRel = (maxZ - minZ) / 10;
  const zMax = maxRel > 0 ? Z_MIN + (Z_MAX - Z_MIN) * Math.min(1, maxRel / 40) : 0;
  const zPerMetre = maxRel > 0 ? zMax / maxRel : 0;
  let len = 0;
  for (let i = 1; i < raw.length; i++) len += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]);
  const planPerMetre = lengthKm && len > 0 ? len / r / (lengthKm * 1000) : null;
  return {
    pts: raw.map(([x, y], i) => ({ x: (x - cx) / r, y: (y - cy) / r, z: rel[i] * zPerMetre })),
    rel,
    maxRel,
    zPerMetre,
    planPerMetre,
    zMax,
  };
}

export interface Camera {
  yaw: number;
  pitch: number;
  dist: number;
  /** Height the camera orbits around. */
  target: number;
  cosY: number;
  sinY: number;
  cosP: number;
  sinP: number;
}

const DEG = Math.PI / 180;

/** Orbit camera: yaw (degrees, around the vertical axis), pitch (degrees above the horizon,
 * 90 = straight down), distance from the target in world units (radius 1 = the circuit). */
export function makeCamera(yawDeg: number, pitchDeg: number, dist = 3.2, target = 0): Camera {
  const y = yawDeg * DEG;
  const p = pitchDeg * DEG;
  return { yaw: yawDeg, pitch: pitchDeg, dist, target, cosY: Math.cos(y), sinY: Math.sin(y), cosP: Math.cos(p), sinP: Math.sin(p) };
}

export interface Projected {
  /** Screen-space x / y in world units at the target distance (y up). */
  x: number;
  y: number;
  /** Distance along the view direction: larger is farther away. */
  depth: number;
}

/** Perspective projection of a world point through the orbit camera. */
export function project(p: P3, c: Camera): Projected {
  const x1 = p.x * c.cosY + p.y * c.sinY;
  const y1 = -p.x * c.sinY + p.y * c.cosY;
  const z1 = p.z - c.target;
  const camX = x1;
  const camY = y1 * c.sinP + z1 * c.cosP;
  const depth = y1 * c.cosP - z1 * c.sinP + c.dist;
  const f = c.dist / Math.max(0.05, depth);
  return { x: camX * f, y: camY * f, depth };
}

/** Split a closed lap of n points into chunks of `size` segments: [startIndex, endIndex] inclusive,
 * consecutive chunks share their boundary point. */
export function chunkRanges(n: number, size: number): [number, number][] {
  const out: [number, number][] = [];
  if (n < 2) return out;
  const s = Math.max(1, Math.floor(size));
  for (let a = 0; a < n - 1; a += s) out.push([a, Math.min(n - 1, a + s)]);
  return out;
}

/**
 * Painter's order: indices of `items` from farthest to nearest. Ties (equal depth, e.g. a flat
 * crossing) put the higher item later so bridges draw over underpasses, then the later index.
 */
export function depthOrder(depths: number[], heights?: number[]): number[] {
  return depths
    .map((_, i) => i)
    .sort((a, b) => {
      const dd = depths[b] - depths[a];
      if (Math.abs(dd) > 1e-9) return dd;
      const hh = (heights?.[a] ?? 0) - (heights?.[b] ?? 0);
      if (Math.abs(hh) > 1e-9) return hh;
      return a - b;
    });
}

export interface Fit {
  scale: number;
  /** Projected-space point that maps to the viewport centre. */
  cx: number;
  cy: number;
}

/**
 * Scale + centre so the circuit fits a w x h viewport at this pitch for ANY yaw (sampled), so the
 * drawing never zooms or clips while the camera orbits.
 */
export function fitViewport(pts: P3[], pitch: number, dist: number, target: number, w: number, h: number, pad = 0.08): Fit {
  if (pts.length === 0 || w <= 0 || h <= 0) return { scale: 1, cx: 0, cy: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let yaw = 0; yaw < 360; yaw += 30) {
    const c = makeCamera(yaw, pitch, dist, target);
    for (const p of pts) {
      const q = project(p, c);
      minX = Math.min(minX, q.x);
      maxX = Math.max(maxX, q.x);
      minY = Math.min(minY, q.y);
      maxY = Math.max(maxY, q.y);
      // also the ground shadow
      const g = project({ x: p.x, y: p.y, z: 0 }, c);
      minY = Math.min(minY, g.y);
      maxY = Math.max(maxY, g.y);
    }
  }
  const sw = (w * (1 - 2 * pad)) / (maxX - minX || 1);
  const sh = (h * (1 - 2 * pad)) / (maxY - minY || 1);
  return { scale: Math.min(sw, sh), cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Scale + centre that frames a set of projected points in a w x h viewport (current view only). */
export function fitBounds(points: { x: number; y: number }[], w: number, h: number, pad = 0.08): Fit {
  if (points.length === 0 || w <= 0 || h <= 0) return { scale: 1, cx: 0, cy: 0 };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const sw = (w * (1 - 2 * pad)) / (maxX - minX || 1);
  const sh = (h * (1 - 2 * pad)) / (maxY - minY || 1);
  return { scale: Math.min(sw, sh), cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

/** Ease a framing toward a target (frame-rate independent), so zoom changes while orbiting glide. */
export function easeFit(cur: Fit, target: Fit, dtMs: number, tauMs = 140): Fit {
  const a = 1 - Math.exp(-dtMs / tauMs);
  return {
    scale: cur.scale + (target.scale - cur.scale) * a,
    cx: cur.cx + (target.cx - cur.cx) * a,
    cy: cur.cy + (target.cy - cur.cy) * a,
  };
}

/** Projected point -> viewport pixels (y down). */
export function toScreen(q: Projected, fit: Fit, w: number, h: number): { x: number; y: number } {
  return { x: w / 2 + (q.x - fit.cx) * fit.scale, y: h / 2 - (q.y - fit.cy) * fit.scale };
}

export const PITCH_MIN = 28;
export const PITCH_MAX = 82;
export const clampPitch = (p: number): number => Math.min(PITCH_MAX, Math.max(PITCH_MIN, p));
/** Wrap yaw into [-180, 180). */
export const wrapYaw = (y: number): number => ((((y + 180) % 360) + 360) % 360) - 180;

/** Frame-rate independent exponential decay for drag inertia (velocity in degrees per ms). */
export function decay(v: number, dtMs: number, halfLifeMs = 160): number {
  return v * Math.pow(0.5, dtMs / halfLifeMs);
}

/** Shortest signed yaw difference (to - from) in degrees. */
export const yawDelta = (from: number, to: number): number => wrapYaw(to - from);

/**
 * Remove telemetry jitter: a value only moves when the signal leaves a +-threshold band around it
 * (hysteresis), so a 0.1 m wobble never counts as climbing.
 */
export function hysteresis(values: number[], threshold: number): number[] {
  if (values.length === 0) return [];
  let s = values[0];
  return values.map((v) => {
    if (v > s + threshold) s = v - threshold;
    else if (v < s - threshold) s = v + threshold;
    return s;
  });
}

export interface ClimbStats {
  lowIndex: number;
  highIndex: number;
  /** Metres between the lowest and the highest point. */
  range: number;
  /** Sum of every ascent around the lap, metres (jitter filtered). */
  totalClimb: number;
  /** Largest uninterrupted ascent: metres and the point indices where it starts and ends. */
  biggestRise: { metres: number; from: number; to: number };
}

/** Elevation statistics for a lap from per-point heights in metres. */
export function climbStats(rel: number[], threshold = 0.4): ClimbStats {
  if (rel.length === 0) return { lowIndex: 0, highIndex: 0, range: 0, totalClimb: 0, biggestRise: { metres: 0, from: 0, to: 0 } };
  let lowIndex = 0;
  let highIndex = 0;
  rel.forEach((v, i) => {
    if (v < rel[lowIndex]) lowIndex = i;
    if (v > rel[highIndex]) highIndex = i;
  });
  const s = hysteresis(rel, threshold);
  let total = 0;
  let best = { metres: 0, from: 0, to: 0 };
  let runStart = 0;
  for (let i = 1; i < s.length; i++) {
    const d = s[i] - s[i - 1];
    if (d > 0) total += d;
    if (d < 0) runStart = i;
    else if (s[i] - s[runStart] > best.metres) best = { metres: s[i] - s[runStart], from: runStart, to: i };
  }
  return { lowIndex, highIndex, range: rel[highIndex] - rel[lowIndex], totalClimb: total, biggestRise: best };
}
