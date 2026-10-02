/** R40: pure transition selection for the public site. No React, no DOM, so it is unit-testable. */

export type TransitionKind = 'flag-wipe' | 'pit-lane' | 'lights-out' | 'crossfade' | 'reduced';
export type NavType = 'PUSH' | 'POP' | 'REPLACE';
export interface Transition {
  kind: TransitionKind;
  durationMs: number;
}

export const DURATION_MS: Record<TransitionKind, number> = {
  'flag-wipe': 750,
  'pit-lane': 700,
  'lights-out': 900,
  crossfade: 350,
  reduced: 150,
};

/** Fraction of the run at which the new route is swapped in (while the overlay covers the page). */
export const SWAP_AT: Record<TransitionKind, number> = {
  'flag-wipe': 0.5,
  'pit-lane': 0.5,
  'lights-out': 0.66,
  crossfade: 0.5,
  reduced: 0.5,
};

export interface RouteMeta {
  /** Timing-tower sector chip, e.g. "S2". */
  sector: string;
  /** Short destination label shown in the flash, e.g. "EVENTS". */
  label: string;
  /** Spoken route title for the aria-live region. */
  title: string;
}

/** Strip search/hash and any trailing slash. */
export function normalizePath(p: string): string {
  const bare = p.split('#')[0].split('?')[0];
  if (bare.length > 1 && bare.endsWith('/')) return bare.replace(/\/+$/, '') || '/';
  return bare || '/';
}

/** Metadata for the public routes only; null for host/logout/error/404 and anything else. */
export function routeMeta(path: string): RouteMeta | null {
  const p = normalizePath(path);
  if (p === '/') return { sector: 'S1', label: 'GRID', title: 'Home' };
  if (p === '/events') return { sector: 'S2', label: 'EVENTS', title: 'Events' };
  if (/^\/events\/[^/]+$/.test(p)) return { sector: 'S3', label: 'CHECKOUT', title: 'Booking checkout' };
  if (p === '/gallery') return { sector: 'S2', label: 'GALLERY', title: 'Gallery' };
  if (p === '/about') return { sector: 'S2', label: 'ABOUT', title: 'About' };
  if (p === '/contact') return { sector: 'S2', label: 'CONTACT', title: 'Contact' };
  if (p === '/profile') return { sector: 'S3', label: 'PROFILE', title: 'Profile' };
  if (/^\/tickets\/[^/]+$/.test(p)) return { sector: 'S3', label: 'TICKET', title: 'Your ticket' };
  if (/^\/join\/[^/]+$/.test(p)) return { sector: 'S1', label: 'JOIN', title: 'Join' };
  return null;
}

export const isPublicPath = (p: string) => routeMeta(p) !== null;

/**
 * Which transition plays when navigating fromPath -> toPath, or null for none (instant swap).
 * Paths may include search/hash. Host, logout, error and unknown routes never animate.
 */
export function transitionFor(
  fromPath: string,
  toPath: string,
  navType: NavType,
  firstVisit: boolean,
): Transition | null {
  const from = normalizePath(fromPath);
  const to = normalizePath(toPath);
  if (!isPublicPath(from) || !isPublicPath(to)) return null;
  if (from === to) return null;
  const make = (kind: TransitionKind): Transition => ({
    kind,
    durationMs: DURATION_MS[kind],
  });
  if (navType === 'POP' || navType === 'REPLACE') return make('crossfade');
  if (firstVisit && from === '/') return make('lights-out');
  if (/^\/events\/[^/]+$/.test(to) || /^\/tickets\/[^/]+$/.test(to)) return make('pit-lane');
  return make('flag-wipe');
}

/** Reduced motion: every transition collapses to a 150ms opacity crossfade (no sweep, no lights). */
export function forMotionPreference(t: Transition, reduceMotion: boolean): Transition {
  return reduceMotion ? { kind: 'reduced', durationMs: DURATION_MS.reduced } : t;
}
