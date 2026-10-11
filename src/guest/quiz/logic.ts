import { parseCardAnswer } from '../../lib/cardAnswer';
import { QUIZ_CLOSE_FRACTION, closeLap, quizHeldByDelay, type QuizClockInput } from '../../lib/quizWindow';
import type { EventConfig, QuestionCfg } from '../../lib/types';
import type { PickMap } from '../draft';
import { istReadout } from '../model';
import type { AnswerCard } from './grid';

const MIN = 60_000;

/** The beat before a pick auto-advances to the next call. */
export const ADVANCE_MS = 650;
/** Driver lists (and any list this long) get a search box. */
export const SEARCH_MIN_OPTIONS = 9;
export const SCORING_NOTE = 'Your picks are scored from the official race result after the chequered flag.';

const DELAY_NOTE = 'Race delayed. The quiz stays open until lights out.';

type Clock = QuizClockInput & Pick<EventConfig, 'raceStartUtc' | 'raceDurationMin' | 'opensAt' | 'closesAt'>;

const hasLaps = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** The lap after which the quiz closes (floor of 30% of the race). */
export const closeLapOf = (totalLaps: number): number => closeLap(totalLaps);

/** Race delayed and not started: the deadline is on hold. */
export const delayedHold = (c: Pick<EventConfig, 'closesAt'> & QuizClockInput): boolean =>
  quizHeldByDelay({ ...c, closesAt: c.closesAt ?? { toMillis: () => 0 } });

/** "Lap 4 / 52 · closes after lap 15" while the host keeps the live lap up to date, else null. */
export function lapLine(c: Pick<EventConfig, 'totalLaps' | 'liveLap'>): string | null {
  if (!hasLaps(c.totalLaps) || typeof c.liveLap !== 'number' || !Number.isFinite(c.liveLap) || c.liveLap < 0) return null;
  const total = Math.floor(c.totalLaps);
  return `Lap ${Math.min(Math.floor(c.liveLap), total)} / ${total} · closes after lap ${closeLapOf(total)}`;
}

/** When the picks open, relative to lights out. */
export function opensCopy(c: Pick<EventConfig, 'raceStartUtc' | 'opensAt'>): string {
  const m = Math.round((c.raceStartUtc.toMillis() - c.opensAt.toMillis()) / MIN);
  if (m > 0) return `Picks open ${m} ${m === 1 ? 'minute' : 'minutes'} before lights out.`;
  return m === 0 ? 'Picks open at lights out.' : 'Picks open shortly after lights out.';
}

/** When the picks close, in the words the guest cares about (laps first, then % of the race, then the clock). */
export function closesCopy(c: Clock): string {
  if (delayedHold(c)) return DELAY_NOTE;
  if (hasLaps(c.totalLaps)) {
    const total = Math.floor(c.totalLaps);
    return `Closes after lap ${closeLapOf(total)} of ${total}, ${Math.round(QUIZ_CLOSE_FRACTION * 100)}% of the race.`;
  }
  const run = c.closesAt.toMillis() - c.raceStartUtc.toMillis();
  const race = c.raceDurationMin * MIN;
  if (race > 0 && run > 0) {
    const pct = Math.round((run / race) * 100);
    if (pct > 0 && pct < 100) return `Closes when ${pct}% of the race has run.`;
  }
  return run <= 0 ? 'Closes at lights out.' : 'Closes when the timer runs out.';
}

/** "After lap 15" / "13:27 IST" for the Closes cell of the facts strip. */
export function closesCell(c: Clock): string {
  const laps = hasLaps(c.totalLaps) ? Math.floor(c.totalLaps) : null;
  if (delayedHold(c)) return 'At lights out';
  return laps ? `After lap ${closeLapOf(laps)}` : `${istReadout(c.closesAt.toMillis()).time} IST`;
}

/** Colour band of the close pill by time left. */
export function urgency(msLeft: number): 'calm' | 'soon' | 'final' {
  return msLeft <= MIN ? 'final' : msLeft <= 5 * MIN ? 'soon' : 'calm';
}

export const isAnswered = (q: QuestionCfg, answers: PickMap): boolean =>
  q.kind === 'card' ? parseCardAnswer(answers[q.id]) !== null : !!answers[q.id];

export function countAnswered(questions: QuestionCfg[], answers: PickMap): number {
  return questions.filter((q) => isAnswered(q, answers)).length;
}

/** Where to go after a pick: the next call, or straight back to the review when editing from it. */
export function nextAfterPick(step: number, total: number, fromReview: boolean): number {
  return fromReview ? total : Math.min(step + 1, total);
}

/** Case-insensitive search over a card's label and sub line. */
export function filterCards(cards: AnswerCard[], query: string): AnswerCard[] {
  const q = query.trim().toLowerCase();
  return q ? cards.filter((c) => `${c.label} ${c.sub ?? ''}`.toLowerCase().includes(q)) : cards;
}
