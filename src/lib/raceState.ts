/** Race state utilities for live race tracking.
 * 
 * Since the Jolpica/Ergast API doesn't provide real-time flag status,
 * we compute race state based on time and allow manual override for demos.
 */

export type RaceState = 
  | 'scheduled'           // Race hasn't started yet
  | 'in-progress'         // Race is live (between lights out and ~2h after)
  | 'yellow-flag'         // Safety car / yellow flag period
  | 'yellow-flag-sector'  // Single yellow sector
  | 'red-flag'            // Red flag - race suspended
  | 'virtual-safety-car'  // VSC period
  | 'last-lap'            // Final lap
  | 'chequered-flag'      // Chequered flag shown - race ending
  | 'completed'           // Race finished
  | 'cancelled-by-host';  // Host cancelled the event

export interface RaceStateInfo {
  state: RaceState;
  label: string;
  /** Human-readable description */
  description: string;
  /** CSS color theme */
  tone: 'accent' | 'warn' | 'ok' | 'bad' | 'muted';
  /** Whether to show the race timer */
  showTimer: boolean;
  /** Whether race has ended (for podium display) */
  isEnded: boolean;
}

/** Typical F1 race duration in milliseconds (90-120 minutes, use 105 min average) */
const RACE_DURATION_MS = 105 * 60 * 1000;

/** Time before race start to consider "about to start" */
const PRE_RACE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/** Time after race end to show podium before next race (24 hours) */
const POST_RACE_PODIUM_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Last lap detection window (last 5% of race) */
const LAST_LAP_WINDOW_MS = RACE_DURATION_MS * 0.05;

/** Manual race state override for demos (can be set in localStorage) */
const MANUAL_OVERRIDE_KEY = 'kartarcup:race:manual-state';

/** Get manual override if set (for demos) */
function getManualOverride(raceId: string): RaceState | null {
  try {
    const stored = localStorage.getItem(MANUAL_OVERRIDE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.raceId === raceId && parsed.expiresAt > Date.now()) {
        return parsed.state;
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return null;
}

/** Set manual override for demo purposes (expires in 1 hour) */
export function setManualRaceState(raceId: string, state: RaceState): void {
  try {
    localStorage.setItem(MANUAL_OVERRIDE_KEY, JSON.stringify({
      raceId,
      state,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
    }));
  } catch {
    /* ignore */
  }
}

/** Clear manual override */
export function clearManualRaceState(): void {
  try {
    localStorage.removeItem(MANUAL_OVERRIDE_KEY);
  } catch {
    /* ignore */
  }
}

/** Compute race state based on race start time and current time */
export function computeRaceState(
  raceStartMs: number,
  raceId: string,
  nowMs: number = Date.now()
): RaceStateInfo {
  // Check for manual override first (for demos)
  const manual = getManualOverride(raceId);
  if (manual) {
    return stateInfo(manual);
  }

  const timeToStart = raceStartMs - nowMs;
  const timeSinceStart = nowMs - raceStartMs;
  const raceEndMs = raceStartMs + RACE_DURATION_MS;
  const timeToEnd = raceEndMs - nowMs;

  // Before race start
  if (timeToStart > PRE_RACE_WINDOW_MS) {
    return stateInfo('scheduled');
  }

  // About to start (15 min window)
  if (timeToStart > 0 && timeToStart <= PRE_RACE_WINDOW_MS) {
    return stateInfo('scheduled'); // Still show countdown
  }

  // Race in progress
  if (timeSinceStart >= 0 && timeToEnd > 0) {
    // Last lap detection
    if (timeToEnd > 0 && timeToEnd <= LAST_LAP_WINDOW_MS) {
      return stateInfo('last-lap');
    }
    // Yellow/Red flag would be manual override only (not auto-detected)
    return stateInfo('in-progress');
  }

  // Race recently finished - show podium
  if (timeToEnd <= 0 && timeToEnd > -POST_RACE_PODIUM_WINDOW_MS) {
    return stateInfo('completed');
  }

  // Race finished more than 24h ago
  if (timeToEnd <= -POST_RACE_PODIUM_WINDOW_MS) {
    return stateInfo('completed'); // Still show completed, but next race will take over
  }

  return stateInfo('scheduled');
}

function stateInfo(state: RaceState): RaceStateInfo {
  const configs: Record<RaceState, Omit<RaceStateInfo, 'state'>> = {
    scheduled: {
      label: 'Lights out in',
      description: 'Race has not started yet',
      tone: 'muted',
      showTimer: true,
      isEnded: false,
    },
    'in-progress': {
      label: 'RACE IN PROGRESS',
      description: 'Race is live now',
      tone: 'accent',
      showTimer: true, // Show elapsed time
      isEnded: false,
    },
    'yellow-flag': {
      label: 'YELLOW FLAG',
      description: 'Safety car deployed',
      tone: 'warn',
      showTimer: true,
      isEnded: false,
    },
    'red-flag': {
      label: 'RED FLAG',
      description: 'Race suspended',
      tone: 'bad',
      showTimer: true,
      isEnded: false,
    },
    'last-lap': {
      label: 'LAST LAP',
      description: 'Final lap - chequered flag incoming',
      tone: 'accent',
      showTimer: true,
      isEnded: false,
    },
    completed: {
      label: 'RACE COMPLETED',
      description: 'Final classification available below',
      tone: 'ok',
      showTimer: false,
      isEnded: true,
    },
    'chequered-flag': {
      label: 'CHEQUERED FLAG',
      description: 'Race ended - final classification below',
      tone: 'accent',
      showTimer: true,
      isEnded: true,
    },
    'virtual-safety-car': {
      label: 'VIRTUAL SAFETY CAR',
      description: 'VSC period - maintain delta',
      tone: 'warn',
      showTimer: true,
      isEnded: false,
    },
    'yellow-flag-sector': {
      label: 'YELLOW FLAG (SECTOR)',
      description: 'Single yellow sector',
      tone: 'warn',
      showTimer: true,
      isEnded: false,
    },
    'cancelled-by-host': {
      label: 'CANCELLED',
      description: 'Event cancelled by host',
      tone: 'bad',
      showTimer: false,
      isEnded: true,
    },
  };

  const cfg = configs[state];
  return { state, ...cfg };
}

/** Get time remaining until race start (positive) or elapsed since start (negative) */
export function getRaceTimeDelta(raceStartMs: number, nowMs: number = Date.now()): number {
  return raceStartMs - nowMs;
}

/** Get elapsed race time (for in-progress timer) */
export function getElapsedRaceTime(raceStartMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, nowMs - raceStartMs);
}

/** Format elapsed time as HH:MM:SS */
export function formatElapsedTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Format time remaining until race start */
export function formatTimeRemaining(ms: number): { days: number; hours: number; minutes: number; seconds: number; done: boolean } {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return { days, hours, minutes, seconds, done: false };
}