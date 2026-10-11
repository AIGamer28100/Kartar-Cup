import type { BookingEvent } from './types';

/** Which quiz is live (host side: big screen, overlay, console, community link). settings/active carries
 * {eventId?, mode?}: 'manual' (absent mode) = the host picked eventId; 'auto' = derived from the hosted
 * watch party that is running or next (R64). */
export type LiveQuizMode = 'manual' | 'auto';

/** Auto looks 8 hours back (a running party) and 72 hours ahead. */
const AUTO_BACK_MS = 8 * 3_600_000;
const AUTO_AHEAD_MS = 72 * 3_600_000;

export const liveQuizMode = (raw: unknown): LiveQuizMode => (raw === 'auto' ? 'auto' : 'manual');

type Party = Pick<BookingEvent, 'id' | 'cancelled' | 'quizEventId'> & { dateMs?: number };

/** The quiz of the nearest watch party in [now-8h, now+72h]; ties go to the earlier date, then the lower id. */
export function deriveLiveQuizId(events: readonly Party[], nowMs: number): string | null {
  let best: (Party & { dateMs: number }) | null = null;
  for (const e of events) {
    const d = e.dateMs;
    if (e.cancelled || !e.quizEventId || typeof d !== 'number' || !Number.isFinite(d)) continue;
    if (d < nowMs - AUTO_BACK_MS || d > nowMs + AUTO_AHEAD_MS) continue;
    const cand = { ...e, dateMs: d };
    if (!best) {
      best = cand;
      continue;
    }
    const a = Math.abs(d - nowMs);
    const b = Math.abs(best.dateMs - nowMs);
    if (a < b || (a === b && (d < best.dateMs || (d === best.dateMs && e.id < best.id)))) best = cand;
  }
  return best?.quizEventId ?? null;
}
