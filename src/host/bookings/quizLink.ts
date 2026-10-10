/** R57: each watch party owns its own quiz doc (`events/{autoId}`), named by `bookingEvents/{id}.quizEventId`.
 * Pure of Firestore (everything goes through `QuizLinkDeps`), so the wiring is unit-testable. */
import { Timestamp } from 'firebase/firestore';
import { ALL_RACES, getRace } from '../../config/calendar';
import { buildDefaultEvent } from '../../config/event';
import { defaultQuizWindow } from '../../lib/quizWindow';
import type { BookingEvent, EventConfig } from '../../lib/types';

export interface QuizLinkDeps {
  /** A fresh, unique `events/` doc id (never a race id). */
  newQuizId(): string;
  /** Current server copy of the booking event (another tab may already have linked a quiz). */
  getBookingEvent(id: string): Promise<BookingEvent | null>;
  getQuiz(id: string): Promise<EventConfig | null>;
  saveQuiz(config: EventConfig): Promise<void>;
  linkQuiz(bookingEventId: string, quizEventId: string): Promise<void>;
}

/** Starting quiz for a watch party: grid, teams and window come from the linked race through the existing
 * OpenF1 / schedule path (R30, R37, R13). With no linked race it starts as a custom event on the party's own date. */
export async function seedQuizConfig(ev: BookingEvent, quizId: string): Promise<EventConfig> {
  const race = ev.raceId ? getRace(ev.raceId) : undefined;
  const { config } = await buildDefaultEvent(race ?? ALL_RACES[0]);
  const seeded: EventConfig = { ...config, id: quizId, name: ev.title.slice(0, 80) };
  if (race) return seeded;
  const startMs = ev.dateMs ?? new Date(ev.dateUtc).getTime();
  const win = defaultQuizWindow(startMs, config.raceDurationMin);
  // No race, so no known lap count: the clock backstop alone closes it unless the host enters the laps.
  const custom: EventConfig = { ...seeded };
  delete custom.totalLaps;
  return {
    ...custom,
    raceId: 'custom',
    circuit: null,
    raceStartUtc: Timestamp.fromMillis(startMs),
    opensAt: Timestamp.fromMillis(win.opensMs),
    closesAt: Timestamp.fromMillis(win.closesMs),
  };
}

const inflight = new Map<string, Promise<string>>();

/** The quiz id for this watch party, creating and linking a fresh quiz the first time. Concurrent calls for
 * the same party (React strict-mode double effects, two tabs) share one creation. */
export function ensureQuizForBookingEvent(ev: BookingEvent, deps: QuizLinkDeps): Promise<string> {
  const running = inflight.get(ev.id);
  if (running) return running;
  const p = (async () => {
    const latest = (await deps.getBookingEvent(ev.id)) ?? ev;
    if (latest.quizEventId && (await deps.getQuiz(latest.quizEventId))) return latest.quizEventId;
    // A linked-but-missing quiz doc (deleted by hand) is re-created under the same id so the link stays valid.
    const quizId = latest.quizEventId ?? deps.newQuizId();
    await deps.saveQuiz(await seedQuizConfig(latest, quizId));
    if (!latest.quizEventId) await deps.linkQuiz(latest.id, quizId);
    return quizId;
  })().finally(() => inflight.delete(ev.id));
  inflight.set(ev.id, p);
  return p;
}
