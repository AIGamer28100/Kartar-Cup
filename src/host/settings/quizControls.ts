/* The ONE state machine behind the host's open/close controls. RaceControl (console top) and LiveControls
 * both render `quizControlState(...).primary`, so the label, the gate and the reason can never disagree (R69).
 * Window math lives in src/lib/quizWindow.ts; this only decides which action is offered.
 * Manual vs Auto (R64/R70): Auto enforces the 10-minute open gate and the 30% cap; Manual may open any time
 * and extend past the cap (the explicit host override is what firestore.rules keys on). */
import { deriveStatus } from '../../lib/eventStatus';
import type { LiveQuizMode } from '../../lib/liveQuiz';
import {
  quizCloseLap,
  quizCloseReason,
  quizEarliestOpenMs,
  quizExtendRoomMin,
} from '../../lib/quizWindow';
import type { DerivedStatus, EventConfig } from '../../lib/types';

export const REOPEN_EXTEND_MIN = 5;

export type QuizControlInput = Pick<
  EventConfig,
  | 'opensAt'
  | 'closesAt'
  | 'override'
  | 'winnerRevealed'
  | 'totalLaps'
  | 'liveLap'
  | 'delayed'
  | 'raceStartedAt'
  | 'raceStartUtc'
  | 'raceDurationMin'
>;

/** What pressing the primary button does. */
export type QuizControlAction =
  | { type: 'override'; value: 'open' | 'closed' | 'none' }
  | { type: 'extend'; minutes: number; uncapped: boolean };

export interface QuizPrimary {
  kind: 'open' | 'close' | 'reopen' | 'none';
  label: string;
  disabled: boolean;
  /** Why it is disabled (shown as visible helper text). */
  reason?: string;
  action?: QuizControlAction;
}

export interface QuizControlState {
  status: DerivedStatus;
  primary: QuizPrimary;
  /** Minutes the close may still be pushed (0 = not extendable; Infinity in Manual mode). */
  extendRoomMin: number;
  /** Manual mode: Extend may pass the 30% cap, as often as the host likes. */
  extendUncapped: boolean;
  /** Shown beside extend buttons when the quiz cannot be extended. */
  extendReason?: string;
  /** "Clear override" only does something when an override is set. */
  canClearOverride: boolean;
}

const istTime = (ms: number) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ms);

export const EXTEND_FULL_REASON = 'The quiz is already at 30% of the race';

export function quizControlState(cfg: QuizControlInput, nowMs: number, mode: LiveQuizMode = 'manual'): QuizControlState {
  const manual = mode === 'manual';
  const status = deriveStatus(cfg, nowMs);
  const anchorMs = (cfg.raceStartedAt ?? cfg.raceStartUtc).toMillis();
  const extendRoomMin = manual
    ? Number.POSITIVE_INFINITY
    : quizExtendRoomMin(anchorMs, cfg.raceDurationMin, cfg.closesAt.toMillis());
  const base = {
    status,
    extendRoomMin,
    extendUncapped: manual,
    extendReason: extendRoomMin > 0 ? undefined : EXTEND_FULL_REASON,
    canClearOverride: cfg.override !== 'none',
  };
  const none: QuizPrimary = { kind: 'none', label: '', disabled: true };

  if (status === 'scored') return { ...base, primary: none };

  if (status === 'open') {
    return {
      ...base,
      primary: { kind: 'close', label: 'Close entries', disabled: false, action: { type: 'override', value: 'closed' } },
    };
  }

  if (status === 'scheduled') {
    const earliest = quizEarliestOpenMs(cfg.raceStartUtc.toMillis());
    const locked = !manual && nowMs < earliest;
    return {
      ...base,
      primary: {
        kind: 'open',
        label: 'Open now',
        disabled: locked,
        reason: locked
          ? `Auto mode opens the quiz 10 minutes before lights out (${istTime(earliest)} IST). Switch to Manual to open it earlier.`
          : undefined,
        action: { type: 'override', value: 'open' },
      },
    };
  }

  // closed
  const why = quizCloseReason(cfg, nowMs);
  if (why === 'lap') {
    return {
      ...base,
      primary: {
        kind: 'reopen',
        label: 'Reopen entries',
        disabled: true,
        reason: `Closed at lap ${quizCloseLap(cfg)}: if the lap was a typo, correct it in Race progress`,
      },
    };
  }
  if (why === 'clock') {
    const reason = extendRoomMin <= 0 ? EXTEND_FULL_REASON : undefined;
    return {
      ...base,
      primary: {
        kind: 'reopen',
        label: `Reopen for ${REOPEN_EXTEND_MIN} more min`,
        disabled: reason !== undefined,
        reason,
        action: { type: 'extend', minutes: REOPEN_EXTEND_MIN, uncapped: manual },
      },
    };
  }
  // closed by the host
  return {
    ...base,
    primary: { kind: 'reopen', label: 'Reopen entries', disabled: false, action: { type: 'override', value: 'none' } },
  };
}
