import type { DerivedStatus } from '../../lib/types';

/**
 * Pure helpers for the host's live overlay (the always-on-top panel cast over the race). No DOM, no
 * Firestore: everything here is testable in node.
 */

/* ---------- sizes ---------- */

export type OverlaySize = 'compact' | 'wide';

export interface SizePreset {
  id: OverlaySize;
  label: string;
  /** Inner (content) size in CSS px. */
  width: number;
  height: number;
  hint: string;
}

export const SIZE_PRESETS: Record<OverlaySize, SizePreset> = {
  compact: { id: 'compact', label: 'Compact', width: 360, height: 220, hint: 'QR, countdown and entries' },
  wide: { id: 'wide', label: 'Wide', width: 640, height: 300, hint: 'Adds the top 5 beside the QR' },
};
export const SIZE_ORDER: OverlaySize[] = ['compact', 'wide'];
export const DEFAULT_SIZE: OverlaySize = 'compact';
export const isOverlaySize = (v: unknown): v is OverlaySize => v === 'compact' || v === 'wide';

/** Window chrome a popup adds around its content (title bar, borders). */
export const POPUP_CHROME = { width: 20, height: 40 };
export const OVERLAY_PATH = '/host/overlay';
export const POPUP_NAME = 'kc-live-overlay';

export function popupFeatures(size: OverlaySize): string {
  const p = SIZE_PRESETS[size];
  return `popup,width=${p.width + POPUP_CHROME.width},height=${p.height + POPUP_CHROME.height}`;
}

/* ---------- PiP stylesheet copy ---------- */

export interface StyleNodeLike {
  disabled?: boolean;
  tagName: string;
  href?: string;
  textContent: string | null;
  getAttribute(name: string): string | null;
}

export type StyleCopy = { kind: 'link'; href: string; media: string | null } | { kind: 'style'; css: string; media: string | null };

/** Which <link>/<style> nodes of the page to copy into a PiP document: enabled, non-alternate stylesheets. */
export function selectStyleCopies(nodes: Iterable<StyleNodeLike>): StyleCopy[] {
  const out: StyleCopy[] = [];
  for (const n of nodes) {
    if (n.disabled) continue;
    const tag = n.tagName.toLowerCase();
    const media = n.getAttribute('media');
    if (tag === 'link') {
      const rel = (n.getAttribute('rel') ?? '').toLowerCase().split(/\s+/);
      if (!rel.includes('stylesheet') || rel.includes('alternate')) continue;
      const href = n.href || n.getAttribute('href');
      if (!href) continue;
      out.push({ kind: 'link', href, media });
    } else if (tag === 'style') {
      const css = n.textContent ?? '';
      if (!css.trim()) continue;
      out.push({ kind: 'style', css, media });
    }
  }
  return out;
}

/** Used when the page's CSS variables cannot be read. */
export const PIP_FALLBACK = { background: '#070b14', color: '#f2f5fa', font: '"Geist Variable", system-ui, sans-serif' };

/* ---------- clock ---------- */

/** 2d 03h, 1:02:03 or 02:03; never negative. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (v: number) => String(v).padStart(2, '0');
  return d > 0 ? `${d}d ${p(h)}h` : h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

export interface OverlayClock {
  label: string;
  value: string;
  /** True when value is a ticking countdown (rendered big); else a phrase. */
  counting: boolean;
}

export function overlayClock(status: DerivedStatus, opensAtMs: number, closesAtMs: number, nowMs: number): OverlayClock {
  if (status === 'scheduled') return { label: 'Opens in', value: formatClock(opensAtMs - nowMs), counting: true };
  if (status === 'open') return { label: 'Closes in', value: formatClock(closesAtMs - nowMs), counting: true };
  if (status === 'scored') return { label: 'Quiz', value: 'Winner revealed', counting: false };
  return { label: 'Entries', value: 'Closed', counting: false };
}

/* ---------- join link ---------- */

/** What the room reads under the QR: no scheme, no www, no trailing slash. */
export function shortJoinUrl(url: string): string {
  return url.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}
