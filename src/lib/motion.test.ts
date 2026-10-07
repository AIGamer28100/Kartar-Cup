import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  bezierAt,
  cssEase,
  DUR,
  DUR_MS,
  EASE,
  formatLapTime,
  formatTicker,
  magneticOffset,
  PAGE_BUDGET_MS,
  reduced,
  staggerDelay,
  STAGGER_MAX_DELAY,
  TRACK_DRAW_MS,
} from './motion';

const tokensCss = readFileSync(fileURLToPath(new URL('../styles/tokens.css', import.meta.url)), 'utf8');
const cssVar = (name: string): string | null => {
  const m = tokensCss.match(new RegExp(`${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
};

describe('motion tokens', () => {
  it('DUR and DUR_MS agree', () => {
    for (const k of Object.keys(DUR) as (keyof typeof DUR)[]) {
      expect(Math.round(DUR[k] * 1000)).toBe(DUR_MS[k]);
    }
  });
  it('CSS custom properties mirror the TS tokens', () => {
    expect(cssVar('--motion-instant')).toBe(`${DUR_MS.instant}ms`);
    expect(cssVar('--motion-fast')).toBe(`${DUR_MS.fast}ms`);
    expect(cssVar('--motion-base')).toBe(`${DUR_MS.base}ms`);
    expect(cssVar('--motion-slow')).toBe(`${DUR_MS.slow}ms`);
    expect(cssVar('--motion-ease-out')).toBe(cssEase(EASE.out));
    expect(cssVar('--motion-ease-in-out')).toBe(cssEase(EASE.inOut));
    expect(cssVar('--motion-ease-launch')).toBe(cssEase(EASE.launch));
  });
  it('the TrackMap draw duration stays the owner value in both places (R44)', () => {
    expect(TRACK_DRAW_MS).toBe(5000);
    expect(cssVar('--track-draw-duration')).toBe(`${TRACK_DRAW_MS / 1000}s`);
  });
  it('page budget is under 450ms', () => {
    expect(PAGE_BUDGET_MS).toBeLessThanOrEqual(450);
  });
});

describe('staggerDelay', () => {
  it('grows linearly then caps', () => {
    expect(staggerDelay(0)).toBe(0);
    expect(staggerDelay(1, 0.05)).toBeCloseTo(0.05);
    expect(staggerDelay(3, 0.05)).toBeCloseTo(0.15);
    expect(staggerDelay(100, 0.05)).toBe(STAGGER_MAX_DELAY);
    expect(staggerDelay(10, 0.1, 0.3)).toBe(0.3);
  });
  it('treats junk input as no delay', () => {
    expect(staggerDelay(-2)).toBe(0);
    expect(staggerDelay(Number.NaN)).toBe(0);
  });
});

describe('bezierAt', () => {
  it('hits the endpoints', () => {
    for (const b of Object.values(EASE)) {
      expect(bezierAt(b, 0)).toBe(0);
      expect(bezierAt(b, 1)).toBe(1);
    }
  });
  it('linear bezier is identity', () => {
    for (const t of [0.1, 0.25, 0.5, 0.9]) expect(bezierAt([0, 0, 1, 1], t)).toBeCloseTo(t, 4);
  });
  it('ease-out is ahead of linear, ease-in behind', () => {
    expect(bezierAt(EASE.out, 0.3)).toBeGreaterThan(0.3);
    expect(bezierAt(EASE.in, 0.3)).toBeLessThan(0.3);
    expect(bezierAt(EASE.inOut, 0.5)).toBeCloseTo(0.5, 2);
  });
  it('is monotonic for the site easings', () => {
    for (const b of Object.values(EASE)) {
      let prev = 0;
      for (let t = 0.02; t <= 1; t += 0.02) {
        const v = bezierAt(b, t);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
        prev = v;
      }
    }
  });
});

describe('reduced', () => {
  const spec = { duration: 0.5, ease: EASE.out, delay: 0.2 };
  it('passes through without reduced motion', () => {
    expect(reduced(spec, false)).toBe(spec);
  });
  it('collapses to instant, or a short fade', () => {
    expect(reduced(spec, true)).toEqual({ duration: 0, delay: 0 });
    const fade = reduced(spec, true, true);
    expect(fade.duration).toBeLessThanOrEqual(DUR.fast);
    expect(fade.delay).toBe(0);
  });
});

describe('formatLapTime', () => {
  it('formats like a timing screen', () => {
    expect(formatLapTime(83.456)).toBe('1:23.456');
    expect(formatLapTime(9.5)).toBe('9.500');
    expect(formatLapTime(60)).toBe('1:00.000');
    expect(formatLapTime(119.9996)).toBe('2:00.000');
    expect(formatLapTime(65.4, 1)).toBe('1:05.4');
    expect(formatLapTime(-1.25, 2)).toBe('-1.25');
    expect(formatLapTime(Number.NaN)).toBe('-');
  });
});

describe('formatTicker', () => {
  it('fixed decimals and grouping', () => {
    expect(formatTicker(4.9271, 3)).toBe('4.927');
    expect(formatTicker(305337, 0, true)).toBe('305,337');
    expect(formatTicker(1234.5, 1, true)).toBe('1,234.5');
    expect(formatTicker(Number.POSITIVE_INFINITY)).toBe('-');
  });
});

describe('magneticOffset', () => {
  it('is zero at the centre and capped at the edges', () => {
    expect(magneticOffset(50, 20, 100, 40)).toEqual({ x: 0, y: 0 });
    expect(magneticOffset(100, 40, 100, 40, 8)).toEqual({ x: 8, y: 8 });
    expect(magneticOffset(-500, 0, 100, 40, 8)).toEqual({ x: -8, y: -8 });
    expect(magneticOffset(10, 10, 0, 0)).toEqual({ x: 0, y: 0 });
  });
});
