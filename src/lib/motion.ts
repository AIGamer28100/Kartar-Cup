/**
 * Motion system: the ONE place for durations, easings, springs and stagger used by the public site
 * (R20/R40). CSS mirrors these as custom properties in src/styles/tokens.css (--motion-*, --ease-*);
 * motion.test.ts checks the two stay in sync. Pure module: no React, no DOM.
 *
 * Rules of thumb
 * - Page transitions finish in under 450ms (PAGE_BUDGET_MS) and never block input.
 * - Animate transform / opacity only (SVG stroke-dashoffset is fine).
 * - Under prefers-reduced-motion: no movement; use `reduced()` to collapse a transition to an
 *   instant or short opacity-only one.
 */

/** Durations in seconds (framer-motion units). */
export const DUR = {
  /** Press feedback, colour/opacity nudges. */
  instant: 0.08,
  /** Hover, small UI state changes. */
  fast: 0.16,
  /** Default UI transition (menus, tabs, chips). */
  base: 0.24,
  /** Content reveals, larger panels. */
  slow: 0.42,
  /** Number tickers, chart draw-ons. */
  ticker: 1.1,
} as const;

/** Same durations in milliseconds (timers, WAAPI). */
export const DUR_MS = {
  instant: 80,
  fast: 160,
  base: 240,
  slow: 420,
  ticker: 1100,
} as const satisfies Record<keyof typeof DUR, number>;

/** Hard ceiling for any route transition (cover + reveal). */
export const PAGE_BUDGET_MS = 450;

/** The owner's TrackMap outline draw-on duration (R44: deliberate, never shorten). Mirrors
 * --track-draw-duration in tokens.css; the kart dot that leads the line uses the same value. */
export const TRACK_DRAW_MS = 5000;

export type Bezier = readonly [number, number, number, number];

/** Cubic-bezier easings. Names describe the feel, not the maths. */
export const EASE = {
  /** Fast start, long soft landing: entrances, reveals. */
  out: [0.22, 1, 0.36, 1],
  /** Gentle in: exits. */
  in: [0.55, 0, 1, 0.45],
  /** Symmetric: covers, wipes, things that cross the screen. */
  inOut: [0.65, 0, 0.35, 1],
  /** Very hard launch then settle, like a kart off the line: number tickers, gauges. */
  launch: [0.16, 1, 0.3, 1],
  /** DRS flap: holds, snaps open, then eases. */
  drs: [0.83, 0, 0.17, 1],
} as const satisfies Record<string, Bezier>;

/** framer-motion springs. */
export const SPRING = {
  /** The site's long-standing default reveal spring (unchanged feel). */
  soft: { type: 'spring', stiffness: 260, damping: 26 },
  /** Snappy UI: nav indicators, toggles, press release. */
  snappy: { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 },
  /** Bouncy, for small celebratory pops (ticks, podium numerals). */
  pop: { type: 'spring', stiffness: 420, damping: 18 },
  /** Magnetic follow for pointer-driven offsets. */
  magnet: { type: 'spring', stiffness: 300, damping: 20, mass: 0.5 },
} as const;

/** Stagger steps in seconds. */
export const STAGGER = {
  tight: 0.035,
  base: 0.06,
  loose: 0.1,
} as const;

/** Never let a long list wait more than this before its last item starts. */
export const STAGGER_MAX_DELAY = 0.42;

/** Delay for the i-th item of a staggered list, capped so long lists still feel instant. */
export function staggerDelay(i: number, step: number = STAGGER.base, max: number = STAGGER_MAX_DELAY): number {
  if (!Number.isFinite(i) || i <= 0) return 0;
  return Math.min(i * step, max);
}

/** CSS string for a bezier, e.g. for inline `transition` styles. */
export const cssEase = (b: Bezier): string => `cubic-bezier(${b.join(', ')})`;

/**
 * Evaluate a CSS-style cubic-bezier easing at time t (0..1). Used by rAF-driven animations that
 * want the same curve as framer/CSS (e.g. the track runner), and in tests.
 */
export function bezierAt(b: Bezier, t: number): number {
  const [x1, y1, x2, y2] = b;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleY = (u: number) => ((ay * u + by) * u + cy) * u;
  const slopeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;
  // Newton-Raphson, then bisection fallback.
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = sampleX(u) - t;
    if (Math.abs(x) < 1e-6) return sampleY(u);
    const d = slopeX(u);
    if (Math.abs(d) < 1e-6) break;
    u -= x / d;
  }
  let lo = 0;
  let hi = 1;
  u = t;
  for (let i = 0; i < 40; i++) {
    const x = sampleX(u);
    if (Math.abs(x - t) < 1e-6) break;
    if (x < t) lo = u;
    else hi = u;
    u = (lo + hi) / 2;
  }
  return sampleY(u);
}

export interface TransitionSpec {
  duration: number;
  ease?: Bezier;
  delay?: number;
}

/** Collapse a transition for reduced motion: instant (0) or a short opacity-only fade. */
export function reduced(spec: TransitionSpec, reduce: boolean, keepFade = false): TransitionSpec {
  if (!reduce) return spec;
  return keepFade ? { duration: Math.min(spec.duration, DUR.fast), ease: EASE.out, delay: 0 } : { duration: 0, delay: 0 };
}

/**
 * Lap-time style formatting for tickers: 83.456 -> "1:23.456", 9.5 -> "9.500".
 * `decimals` defaults to 3 like a timing screen.
 */
export function formatLapTime(seconds: number, decimals = 3): string {
  if (!Number.isFinite(seconds)) return '-';
  const sign = seconds < 0 ? '-' : '';
  const abs = Math.abs(seconds);
  const factor = 10 ** decimals;
  const rounded = Math.round(abs * factor) / factor;
  const m = Math.floor(rounded / 60);
  const s = rounded - m * 60;
  const sStr = s.toFixed(decimals);
  if (m === 0) return `${sign}${sStr}`;
  const [whole, frac] = sStr.split('.');
  return `${sign}${m}:${whole.padStart(2, '0')}${frac !== undefined ? `.${frac}` : ''}`;
}

/** Format a ticker value with fixed decimals and optional thousands separators. */
export function formatTicker(value: number, decimals = 0, group = false): string {
  if (!Number.isFinite(value)) return '-';
  const fixed = value.toFixed(decimals);
  if (!group) return fixed;
  const [whole, frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac !== undefined ? `${grouped}.${frac}` : grouped;
}

/** Clamp helper shared by pointer-driven effects. */
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * Magnetic offset for a pointer at (px, py) over a box of size (w, h): returns a translate that pulls
 * the element toward the pointer, at most `strength` px, zero at the centre.
 */
export function magneticOffset(px: number, py: number, w: number, h: number, strength = 6): { x: number; y: number } {
  if (w <= 0 || h <= 0) return { x: 0, y: 0 };
  const nx = clamp((px - w / 2) / (w / 2), -1, 1);
  const ny = clamp((py - h / 2) / (h / 2), -1, 1);
  return { x: nx * strength, y: ny * strength };
}
