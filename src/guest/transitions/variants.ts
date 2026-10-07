/** R40: pure transition selection for the public site. No React, no DOM, so it is unit-testable. */

import { PAGE_BUDGET_MS } from '../../lib/motion';

/**
 * - kerb-sweep: default forward navigation; a navy panel with red/white kerb edges sweeps across.
 * - chequered:  into a race weekend page; the sweep's leading edge is a chequered flag.
 * - pit-lane:   into checkout / a ticket; the panel drops in vertically like a pit board.
 * - lights-out: the first navigation away from the landing page; five lights, then lights out.
 * - crossfade:  back/forward and replace navigations (quiet).
 * - reduced:    prefers-reduced-motion: a very short opacity-only fade.
 */
export type TransitionKind = 'kerb-sweep' | 'chequered' | 'pit-lane' | 'lights-out' | 'crossfade' | 'reduced';
export type NavType = 'PUSH' | 'POP' | 'REPLACE';
/** Horizontal travel direction for sweeps: 1 = left-to-right, -1 = right-to-left. */
export type Dir = 1 | -1;

export interface Transition {
  kind: TransitionKind;
  /** Time for the overlay to fully cover the page (the new route swaps in after this). */
  coverMs: number;
  /** Time for the overlay to clear off the new page. */
  revealMs: number;
  /** coverMs + revealMs (when the route chunk is already loaded). */
  durationMs: number;
  dir: Dir;
}

export const TIMING: Record<TransitionKind, { coverMs: number; revealMs: number }> = {
  'kerb-sweep': { coverMs: 200, revealMs: 230 },
  chequered: { coverMs: 200, revealMs: 230 },
  'pit-lane': { coverMs: 200, revealMs: 230 },
  'lights-out': { coverMs: 260, revealMs: 180 },
  crossfade: { coverMs: 130, revealMs: 150 },
  reduced: { coverMs: 70, revealMs: 80 },
};

/** If the next route's code has not arrived when the cover completes, hold at most this long before
 * swapping anyway (the page's own skeleton then takes over). Navigation always completes. */
export const MAX_HOLD_MS = 1500;

export { PAGE_BUDGET_MS };

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
  if (/^\/races\/[^/]+$/.test(p)) return { sector: 'S2', label: 'RACE', title: 'Race weekend' };
  if (p === '/gallery') return { sector: 'S2', label: 'GALLERY', title: 'Gallery' };
  if (p === '/cup') return { sector: 'S2', label: 'CUP', title: 'Karter Cup' };
  if (p === '/about') return { sector: 'S2', label: 'ABOUT', title: 'About' };
  if (p === '/contact') return { sector: 'S2', label: 'CONTACT', title: 'Contact' };
  if (p === '/stories') return { sector: 'S2', label: 'STORIES', title: 'Stories' };
  if (/^\/stories\/[^/]+$/.test(p)) return { sector: 'S2', label: 'STORY', title: 'Story' };
  if (p === '/partners') return { sector: 'S2', label: 'PARTNERS', title: 'Partners' };
  if (p === '/terms') return { sector: 'S3', label: 'TERMS', title: 'Terms and conditions' };
  if (p === '/privacy') return { sector: 'S3', label: 'PRIVACY', title: 'Privacy policy' };
  if (p === '/profile') return { sector: 'S3', label: 'PROFILE', title: 'Profile' };
  if (/^\/tickets\/[^/]+$/.test(p)) return { sector: 'S3', label: 'TICKET', title: 'Your ticket' };
  if (/^\/join\/[^/]+$/.test(p)) return { sector: 'S1', label: 'JOIN', title: 'Join' };
  return null;
}

export const isPublicPath = (p: string) => routeMeta(p) !== null;

/** Running order of the public site (roughly the nav order), used for sweep direction. */
const ORDER = ['/', '/events', '/races', '/cup', '/gallery', '/stories', '/partners', '/about', '/contact', '/terms', '/privacy', '/profile', '/tickets', '/join'];

/** Position of a path in the running order (by its first segment). */
export function routeOrder(path: string): number {
  const p = normalizePath(path);
  if (p === '/') return 0;
  const root = `/${p.split('/')[1]}`;
  const i = ORDER.indexOf(root);
  return i < 0 ? ORDER.length : i;
}

/** Forward through the running order sweeps left-to-right; backward sweeps right-to-left. Deeper
 * pages under the same section (list -> detail) count as forward. */
export function sweepDir(from: string, to: string): Dir {
  const a = routeOrder(from);
  const b = routeOrder(to);
  if (b === a) return normalizePath(to).length >= normalizePath(from).length ? 1 : -1;
  return b > a ? 1 : -1;
}

const make = (kind: TransitionKind, dir: Dir): Transition => ({
  kind,
  coverMs: TIMING[kind].coverMs,
  revealMs: TIMING[kind].revealMs,
  durationMs: TIMING[kind].coverMs + TIMING[kind].revealMs,
  dir,
});

/**
 * Which transition plays when navigating fromPath -> toPath, or null for none (instant swap).
 * Paths may include search/hash. Host, logout, error and unknown routes never animate.
 */
export function transitionFor(fromPath: string, toPath: string, navType: NavType, firstVisit: boolean): Transition | null {
  const from = normalizePath(fromPath);
  const to = normalizePath(toPath);
  if (!isPublicPath(from) || !isPublicPath(to)) return null;
  if (from === to) return null;
  if (navType === 'POP') return make('crossfade', -1);
  if (navType === 'REPLACE') return make('crossfade', 1);
  if (firstVisit && from === '/') return make('lights-out', 1);
  if (/^\/events\/[^/]+$/.test(to) || /^\/tickets\/[^/]+$/.test(to)) return make('pit-lane', 1);
  if (/^\/races\/[^/]+$/.test(to)) return make('chequered', sweepDir(from, to));
  return make('kerb-sweep', sweepDir(from, to));
}

/** Reduced motion: every transition collapses to a short opacity-only fade (no sweep, no lights). */
export function forMotionPreference(t: Transition, reduceMotion: boolean): Transition {
  return reduceMotion ? make('reduced', t.dir) : t;
}
