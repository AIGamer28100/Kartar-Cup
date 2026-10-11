import type { Booking } from '../lib/types';
import type { OwnEntryRow } from './profileModel';

/** Achievements derived purely from the signed-in guest's OWN entries + bookings (R15/R31).
 * Nothing is stored or fabricated (R26): every badge is a function of real own data. */

export type AchievementIcon = 'flag' | 'target' | 'eye' | 'repeat' | 'flame' | 'seat' | 'ticket';

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: AchievementIcon;
  earned: boolean;
  /** Present for count-based badges; `have` is capped at `need`. */
  progress?: { have: number; need: number };
}

export interface Streaks {
  current: number;
  best: number;
}

/** One row per event: a duplicate eventId keeps the scored row (higher score wins), else the latest. */
function dedupe(history: OwnEntryRow[]): OwnEntryRow[] {
  const byEvent = new Map<string, OwnEntryRow>();
  for (const r of history) {
    const prev = byEvent.get(r.eventId);
    if (!prev) {
      byEvent.set(r.eventId, r);
      continue;
    }
    let better: boolean;
    if (r.score !== null && prev.score === null) better = true;
    else if (r.score === null && prev.score !== null) better = false;
    else if (r.score !== null && prev.score !== null && r.score !== prev.score) better = r.score > prev.score;
    else better = r.submittedAtMs >= prev.submittedAtMs;
    if (better) byEvent.set(r.eventId, r);
  }
  return [...byEvent.values()];
}

/** Consecutive events entered. Needs `eventOrder` (position among all events) on every row to
 * detect a skipped event; without it the entries are treated as consecutive. `current` is the run
 * ending at the most recent event the guest entered. */
export function computeStreaks(history: OwnEntryRow[]): Streaks {
  const rows = dedupe(history);
  if (rows.length === 0) return { current: 0, best: 0 };
  const ordered = rows.every((r) => typeof r.eventOrder === 'number');
  const positions = ordered
    ? [...new Set(rows.map((r) => r.eventOrder as number))].sort((a, b) => a - b)
    : rows.map((_, i) => i);
  let best = 1;
  let run = 1;
  for (let i = 1; i < positions.length; i++) {
    run = positions[i] === positions[i - 1] + 1 ? run + 1 : 1;
    if (run > best) best = run;
  }
  return { current: run, best };
}

function counted(
  id: string,
  label: string,
  description: string,
  icon: AchievementIcon,
  have: number,
  need: number,
): Achievement {
  return { id, label, description, icon, earned: have >= need, progress: { have: Math.min(have, need), need } };
}

export function computeAchievements(history: OwnEntryRow[], bookings: Booking[]): Achievement[] {
  const rows = dedupe(history);
  const scored = rows.filter((r) => r.score !== null);
  const entered = rows.length;
  const perfect = scored.filter((r) => (r.maxScore ?? 0) > 0 && (r.score as number) >= (r.maxScore as number)).length;
  const sharp = scored.filter((r) => (r.score as number) >= 3).length;
  const { best } = computeStreaks(history);
  const live = bookings.filter((b) => b.status !== 'cancelled');
  const checkedInEvents = new Set(bookings.filter((b) => b.status === 'checked_in').map((b) => b.bookingEventId)).size;

  return [
    counted('first-prediction', 'First prediction', 'Lock in picks for an event.', 'flag', entered, 1),
    counted('perfect-card', 'Perfect card', 'Get every scored question right in one event.', 'target', perfect, 1),
    counted('sharp-eye', 'Sharp eye', 'Get 3 or more right in one scored event.', 'eye', sharp, 1),
    counted('regular-3', 'Regular', 'Enter 3 events.', 'repeat', entered, 3),
    counted('regular-5', 'Regular, level 2', 'Enter 5 events.', 'repeat', entered, 5),
    counted('streak-3', 'Streak of 3', 'Enter 3 events in a row.', 'flame', best, 3),
    counted('watch-party-regular', 'Watch-party regular', 'Check in at 2 watch parties.', 'seat', checkedInEvents, 2),
    counted('early-bird', 'Early bird', 'Book a watch-party ticket.', 'ticket', live.length, 1),
  ];
}
