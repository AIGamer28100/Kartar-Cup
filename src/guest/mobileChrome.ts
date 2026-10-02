import type { DerivedStatus } from '../lib/types';
import { formatRemaining } from './model';

export type TabId = 'home' | 'events' | 'predict' | 'profile';

/** Paths that never get the public mobile chrome (bar + strip). Matched on whole segments. */
const HIDDEN_ROOTS = ['host', 'logout', 'error', 'join'];

const segments = (path: string): string[] => path.split(/[?#]/)[0].split('/').filter(Boolean);

/** Whether the mobile tab bar / race strip belong on this path. */
export function chromeVisible(path: string): boolean {
  const [root] = segments(path);
  return !(root && HIDDEN_ROOTS.includes(root));
}

/**
 * Which tab is current for a path. Predict is an action (the quiz is a view of Home, not a route),
 * so it is never the current page; pages with no tab (gallery, 404) return null.
 */
export function activeTab(path: string): TabId | null {
  const [root] = segments(path);
  if (!root) return 'home';
  if (root === 'events') return 'events';
  if (root === 'profile' || root === 'tickets') return 'profile';
  return null;
}

/** The quiz CTA opens only while the window is genuinely open (same gate as QuizBanner). */
export const predictEnabled = (status: DerivedStatus | null | undefined): boolean => status === 'open';

/** Why Predict is unavailable, for the disabled state. */
export function predictHint(status: DerivedStatus | null | undefined): string {
  if (status === 'scheduled') return 'Predictions open at lights-out.';
  if (status === 'closed' || status === 'scored') return 'Predictions are closed for this race.';
  return 'No race to predict right now.';
}

export const STRIP_LEAD_MS = 48 * 3600_000; // scheduled event shows from 48h before lights-out
export const STRIP_LOCKED_MS = 12 * 3600_000; // locked state lingers 12h past lights-out

export interface StripCopy {
  kind: 'scheduled' | 'open' | 'locked';
  label: string;
  /** Formatted countdown, or null when there is nothing to count down. */
  time: string | null;
  /** Full sentence for assistive tech. */
  sr: string;
}

const DAY = 86400_000;

/** Strip copy from derived status, or null when the strip should stay hidden. */
export function stripCopy(
  status: DerivedStatus | null | undefined,
  closesAtMs: number,
  nowMs: number,
): StripCopy | null {
  const remaining = closesAtMs - nowMs;
  if (status === 'scheduled') {
    if (remaining > STRIP_LEAD_MS) return null;
    const time =
      remaining >= DAY
        ? `${Math.floor(remaining / DAY)}d ${Math.floor((remaining % DAY) / 3600_000)}h`
        : formatRemaining(remaining);
    return { kind: 'scheduled', label: 'Lights out in', time, sr: `Lights out in ${time}` };
  }
  if (status === 'open') {
    const time = formatRemaining(remaining);
    return { kind: 'open', label: 'Predictions open - closes in', time, sr: `Predictions open, closes in ${time}` };
  }
  if (status === 'closed') {
    if (-remaining > STRIP_LOCKED_MS) return null;
    return { kind: 'locked', label: 'Predictions locked', time: null, sr: 'Predictions locked' };
  }
  return null; // scored, or no event
}
