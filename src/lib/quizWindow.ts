/* When the quiz is open. The quiz is a prediction game for people watching the race live, so its window is
 * tied to the race itself, not to the host's taste:
 *   - it opens 10 minutes before lights out (never earlier),
 *   - it ALWAYS closes before 30% of the race has been run (never later, however long the host stretches it).
 * firestore.rules enforces the same two bounds from the event's own raceStartUtc / raceDurationMin, so a
 * client that skips this module is refused too. Keep the constants here and the rule in step. */

export const QUIZ_OPENS_BEFORE_MIN = 10;
/** The share of the race that may have been run when the quiz closes. */
export const QUIZ_CLOSE_FRACTION = 0.3;
/** Longest scheduled race the rules accept (a race is capped at 2 hours plus stoppages). */
export const QUIZ_MAX_RACE_MIN = 180;
export const QUIZ_MIN_RACE_MIN = 30;

const MIN = 60_000;

/** Earliest the quiz may open: 10 minutes before lights out. */
export const quizEarliestOpenMs = (raceStartMs: number): number => raceStartMs - QUIZ_OPENS_BEFORE_MIN * MIN;

/** Latest the quiz may close: 30% of the race after lights out. 0.3 x minutes x 60s = 18s per race minute. */
export const quizLatestCloseMs = (raceStartMs: number, raceDurationMin: number): number =>
  raceStartMs + Math.floor(raceDurationMin * 18) * 1000;

export interface QuizWindow {
  opensMs: number;
  closesMs: number;
}

/** The standard window: opens as early as allowed, closes as late as allowed. */
export function defaultQuizWindow(raceStartMs: number, raceDurationMin: number): QuizWindow {
  return { opensMs: quizEarliestOpenMs(raceStartMs), closesMs: quizLatestCloseMs(raceStartMs, raceDurationMin) };
}

export interface ClampedWindow extends QuizWindow {
  /** Plain-language notes for each bound that moved the host's value (empty when nothing changed). */
  notes: string[];
}

/** Pull a window back inside the bounds. A host may open later or close earlier, never the other way. */
export function clampQuizWindow(raceStartMs: number, raceDurationMin: number, opensMs: number, closesMs: number): ClampedWindow {
  const earliest = quizEarliestOpenMs(raceStartMs);
  const latest = quizLatestCloseMs(raceStartMs, raceDurationMin);
  const notes: string[] = [];
  let o = opensMs;
  let c = closesMs;
  if (o < earliest) {
    o = earliest;
    notes.push(`The quiz cannot open earlier than ${QUIZ_OPENS_BEFORE_MIN} minutes before lights out.`);
  }
  if (c > latest) {
    c = latest;
    notes.push(`The quiz must close before ${Math.round(QUIZ_CLOSE_FRACTION * 100)}% of the race has been run.`);
  }
  if (c <= o) {
    // Only possible when the host opens it too late for the cap: keep a minute so the window is valid.
    o = Math.min(o, latest - MIN);
    c = latest;
    notes.push('The quiz must be open for at least a minute before it closes.');
  }
  return { opensMs: o, closesMs: c, notes };
}

/** How many more minutes the close may be pushed (what an "extend" button may offer), never negative. */
export const quizExtendRoomMin = (raceStartMs: number, raceDurationMin: number, closesMs: number): number =>
  Math.max(0, Math.floor((quizLatestCloseMs(raceStartMs, raceDurationMin) - closesMs) / MIN));

/** Is this window inside the bounds (what the rules check)? */
export function isQuizWindowAllowed(raceStartMs: number, raceDurationMin: number, opensMs: number, closesMs: number): boolean {
  return (
    Number.isFinite(raceStartMs) &&
    raceDurationMin >= QUIZ_MIN_RACE_MIN &&
    raceDurationMin <= QUIZ_MAX_RACE_MIN &&
    opensMs >= quizEarliestOpenMs(raceStartMs) &&
    closesMs <= quizLatestCloseMs(raceStartMs, raceDurationMin) &&
    closesMs > opensMs
  );
}

/* ---------- live close logic (owner rules 2026-10-09) ----------
 * The quiz closes on whichever comes first:
 *   - the host closes it (override 'closed'),
 *   - the leader has completed closeLap(totalLaps) laps (host-entered from the broadcast lap counter; races
 *     run long with red flags and safety cars, so the lap count is the real measure of "30% of the race"),
 *   - the stored deadline closesAt passes (the wall-clock backstop for when nobody updates the lap),
 *     EXCEPT while the host has marked the race delayed and it has not started: the 30% allowance only starts
 *     counting at the actual lights out.
 * firestore.rules applies the same formula to entry writes. Keep the two in step. */

/** Safety margin taken off the recomputed deadline at lights out, so client clock skew cannot exceed the rule cap. */
export const QUIZ_LIGHTS_OUT_MARGIN_MS = 60_000;
export const QUIZ_MAX_LAPS = 100;

/** The lap whose completion closes the quiz: floor(30% of the race laps). 56 -> 16, 78 -> 23, 44 -> 13. */
export const closeLap = (totalLaps: number): number => Math.floor((totalLaps * 3) / 10);

/** Anything with toMillis() (a Firestore Timestamp), kept structural so this module stays free of Firebase. */
interface Millis {
  toMillis(): number;
}

/** The fields of an event config the close logic reads (an EventConfig satisfies it as is). */
export interface QuizClockInput {
  closesAt: Millis;
  /** Scheduled lights out and race length: only needed to tell whether the close was pushed past the 30% cap. */
  raceStartUtc?: Millis;
  raceDurationMin?: number;
  override?: 'none' | 'open' | 'closed';
  totalLaps?: number;
  liveLap?: number;
  delayed?: boolean;
  /** Set once by the host at the actual lights out. null while a server timestamp is still pending. */
  raceStartedAt?: Millis | null;
}

/** Has the host marked the actual lights out? */
export const quizRaceStarted = (c: QuizClockInput): boolean => c.raceStartedAt != null;

/** Delayed and not started: the deadline is on hold and the quiz stays open past it. */
export const quizHeldByDelay = (c: QuizClockInput): boolean => c.delayed === true && !quizRaceStarted(c);

/** The lap that closes this quiz, or null when the total laps are unknown (clock backstop only). */
export const quizCloseLap = (c: QuizClockInput): number | null =>
  c.totalLaps && c.totalLaps > 0 ? closeLap(c.totalLaps) : null;

/** The 30% clock cap in force: from the actual lights out, else the scheduled one. null when unknown. */
function quizCapMs(c: QuizClockInput): number | null {
  const start = c.raceStartedAt ?? c.raceStartUtc;
  return start && c.raceDurationMin ? quizLatestCloseMs(start.toMillis(), c.raceDurationMin) : null;
}

/** Manual mode: the host held the quiz open (override 'open') and pushed the close past the 30% cap (R70). */
export function quizExtendedPastCap(c: QuizClockInput): boolean {
  const cap = quizCapMs(c);
  return c.override === 'open' && cap !== null && c.closesAt.toMillis() > cap;
}

/** Closed because the leader has completed the close lap (unless the host pushed the close past the cap). */
export function quizClosedByLap(c: QuizClockInput): boolean {
  const lap = quizCloseLap(c);
  return lap !== null && c.liveLap !== undefined && c.liveLap >= lap && !quizExtendedPastCap(c);
}

/** The wall-clock deadline in force, or null while it is on hold for a delayed start. */
export const quizClosesAtMs = (c: QuizClockInput): number | null => (quizHeldByDelay(c) ? null : c.closesAt.toMillis());

export type QuizCloseReason = 'override' | 'lap' | 'clock';

/** Why the quiz is closed at nowMs, or null when the close rules do not apply yet. */
export function quizCloseReason(c: QuizClockInput, nowMs: number): QuizCloseReason | null {
  if (c.override === 'closed') return 'override';
  if (quizClosedByLap(c)) return 'lap';
  const at = quizClosesAtMs(c);
  if (at !== null && nowMs >= at) return 'clock';
  return null;
}

/** Is the quiz closed at nowMs (by the host, by the lap count or by the clock)? */
export const quizIsClosed = (c: QuizClockInput, nowMs: number): boolean => quizCloseReason(c, nowMs) !== null;

/** The deadline written at the actual lights out: 30% of the race from then, less the clock-skew margin. */
export const lightsOutClosesAtMs = (startedMs: number, raceDurationMin: number): number =>
  quizLatestCloseMs(startedMs, raceDurationMin) - QUIZ_LIGHTS_OUT_MARGIN_MS;

/** Clamp a host-entered lap to a whole number in 0..totalLaps. */
export const clampLap = (lap: number, totalLaps: number): number =>
  Math.min(Math.max(0, Math.round(Number.isFinite(lap) ? lap : 0)), Math.max(0, Math.floor(totalLaps)));
