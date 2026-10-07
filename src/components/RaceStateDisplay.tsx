import { Trophy } from '@phosphor-icons/react';
import { useState, useEffect, useRef } from 'react';
import { DigitRoll } from './motion';

export type RaceState =
  | 'scheduled'
  | 'lights-out-sequence'
  | 'lights-out-countdown'
  | 'in-progress'
  | 'yellow-flag'
  | 'yellow-flag-sector'
  | { type: 'yellow-flag-sector'; sector: 1 | 2 | 3 }
  | 'red-flag'
  | { type: 'red-flag'; resumeAtMs?: number; resumeProcedure?: 'standing' | 'rolling' }
  | 'safety-car'
  | { type: 'safety-car'; isRollingRestart: boolean }
  | 'safety-car-ending'
  | 'virtual-safety-car'
  | 'last-lap'
  | 'chequered-flag'
  | 'completed'
  | 'cancelled-by-host'
  | 'upcoming'
  | 'unknown';

export interface RaceStateInfo {
  label: string;
  description: string;
  tone: 'muted' | 'accent' | 'warn' | 'ok' | 'bad';
  showTimer: boolean;
  isEnded: boolean;
}

export interface PodiumDriver {
  position: number;
  name: string;
  code: string;
  team: string;
  colour: string;
  headshotUrl: string | null;
  points: number;
}

export function getRaceStateInfo(state: RaceState): RaceStateInfo {
  const type = typeof state === 'object' ? state.type : state;

  const configs: Record<string, RaceStateInfo> = {
    scheduled: {
      label: 'Scheduled',
      description: 'The race is on the calendar',
      tone: 'muted',
      showTimer: false,
      isEnded: false,
    },
    upcoming: {
      label: 'Upcoming',
      description: 'Race starting soon',
      tone: 'muted',
      showTimer: false,
      isEnded: false,
    },
    'lights-out-sequence': {
      label: 'Start Sequence',
      description: 'Drivers forming the grid',
      tone: 'accent',
      showTimer: false,
      isEnded: false,
    },
    'lights-out-countdown': {
      label: 'Lights Out',
      description: 'Wait for the red lights to go out',
      tone: 'accent',
      showTimer: false,
      isEnded: false,
    },
    'in-progress': {
      label: 'Racing',
      description: 'The race is currently active',
      tone: 'ok',
      showTimer: false,
      isEnded: false,
    },
    'yellow-flag': {
      label: 'Yellow Flag',
      description: 'Caution: Hazard on track',
      tone: 'warn',
      showTimer: false,
      isEnded: false,
    },
    'yellow-flag-sector': {
      label: 'Sector Yellow',
      description: 'Caution in a specific sector',
      tone: 'warn',
      showTimer: false,
      isEnded: false,
    },
    'safety-car': {
      label: 'Safety Car',
      description: 'Race neutralized by the Safety Car',
      tone: 'warn',
      showTimer: false,
      isEnded: false,
    },
    'safety-car-ending': {
      label: 'Safety Car Ending',
      description: ' Preparing for the restart',
      tone: 'warn',
      showTimer: false,
      isEnded: false,
    },
    'virtual-safety-car': {
      label: 'Virtual Safety Car',
      description: 'VSC: Reduce speed to delta time',
      tone: 'warn',
      showTimer: false,
      isEnded: false,
    },
    'red-flag': {
      label: 'Red Flag',
      description: 'Race suspended',
      tone: 'bad',
      showTimer: true,
      isEnded: false,
    },
    'last-lap': {
      label: 'Last Lap',
      description: 'The final lap of the race',
      tone: 'accent',
      showTimer: false,
      isEnded: false,
    },
    'chequered-flag': {
      label: 'Chequered Flag',
      description: 'Race concluded',
      tone: 'ok',
      showTimer: false,
      isEnded: true,
    },
    completed: {
      label: 'Completed',
      description: 'Race results finalized',
      tone: 'muted',
      showTimer: false,
      isEnded: true,
    },
    'cancelled-by-host': {
      label: 'Cancelled',
      description: 'Race was cancelled by the host',
      tone: 'bad',
      showTimer: false,
      isEnded: true,
    },
    unknown: {
      label: 'Unknown State',
      description: 'State not recognized',
      tone: 'muted',
      showTimer: false,
      isEnded: false,
    },
  };

  const info = configs[type] || configs.unknown;

  if (typeof state === 'object' && state.type === 'red-flag') {
    const procedure = state.resumeProcedure === 'rolling' ? 'Rolling' : 'Standing';
    return {
      ...info,
      label: `Red Flag · ${procedure} Restart`,
      description: `Race suspended - preparing for ${procedure.toLowerCase()} restart`,
    };
  }

  if (typeof state === 'object' && state.type === 'safety-car' && state.isRollingRestart) {
    return {
      ...info,
      label: 'Rolling Restart',
      description: 'Safety Car leading the field for a rolling restart',
    };
  }

  return info;
}

export function getRaceStateBackgroundStyle(state: RaceState): React.CSSProperties | undefined {
  const type: string = typeof state === 'object' ? state.type : state;

  if (
    type === 'scheduled' ||
    type === 'upcoming' ||
    type === 'unknown' ||
    type === 'in-progress' ||
    type === 'last-lap' ||
    type === 'cancelled-by-host'
  ) return undefined;

  const configs: Record<string, React.CSSProperties> = {
    'lights-out-sequence': {
      backgroundImage: 'linear-gradient(135deg, rgba(127, 29, 29, 0.24), rgba(69, 10, 10, 0.12))',
    },
    'lights-out-countdown': {
      backgroundImage: 'linear-gradient(135deg, rgba(185, 28, 28, 0.28), rgba(127, 29, 29, 0.14))',
    },
    'yellow-flag': {
      backgroundImage: 'linear-gradient(135deg, rgba(234, 179, 8, 0.23), rgba(161, 98, 7, 0.13))',
    },
    'yellow-flag-sector': {
      backgroundImage: 'linear-gradient(135deg, rgba(234, 179, 8, 0.25), rgba(161, 98, 7, 0.15))',
    },
    'safety-car-ending': {
      backgroundImage: 'linear-gradient(135deg, rgba(234, 179, 8, 0.22), rgba(61, 220, 151, 0.12))',
    },
    'red-flag': {
      backgroundImage: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25), rgba(127, 29, 29, 0.15))',
    },
    'safety-car': {
      backgroundImage: 'repeating-linear-gradient(135deg, rgba(15, 23, 42, 0.06) 0 16px, transparent 16px 32px), linear-gradient(135deg, rgba(234, 179, 8, 0.22), rgba(161, 98, 7, 0.12))',
    },
    'virtual-safety-car': {
      backgroundImage: 'repeating-linear-gradient(135deg, rgba(15, 23, 42, 0.08) 0 16px, transparent 16px 32px), linear-gradient(135deg, rgba(234, 179, 8, 0.20), rgba(161, 98, 7, 0.12))',
    },
    'chequered-flag': {
      backgroundImage: 'linear-gradient(135deg, rgba(39, 39, 42, 0.18), rgba(9, 9, 11, 0.10))',
    },
    'completed': {
      backgroundImage: 'linear-gradient(135deg, rgba(39, 39, 42, 0.15), rgba(9, 9, 11, 0.08))',
    },
  };

  return configs[type];
}

export function RaceStateBackdrop({ state, className = '' }: { state: RaceState; className?: string }) {
  const backgroundStyle = getRaceStateBackgroundStyle(state);
  if (!backgroundStyle) return null;

  const type = typeof state === 'object' ? state.type : state;
  const motionClass = type === 'lights-out-sequence' || type === 'lights-out-countdown'
    ? 'race-state-backdrop--start'
    : type === 'chequered-flag' || type === 'completed'
      ? 'race-state-backdrop--chequered'
    : type === 'yellow-flag' || type === 'yellow-flag-sector' || type === 'safety-car' || type === 'safety-car-ending' || type === 'red-flag' || type === 'virtual-safety-car'
      ? 'race-state-backdrop--wave'
      : '';

  return (
    <div
      aria-hidden="true"
      className={`race-state-backdrop ${motionClass} ${className}`}
      style={backgroundStyle}
    />
  );
}

function isCautionState(state: RaceState): boolean {
  const type = typeof state === 'object' ? state.type : state;
  return type === 'yellow-flag' || type === 'yellow-flag-sector' || type === 'safety-car' || type === 'safety-car-ending' || type === 'red-flag' || type === 'virtual-safety-car';
}

function PodiumCard({ driver }: { driver: PodiumDriver }) {
  const positionColors = {
    1: 'var(--color-gold)',
    2: 'var(--color-muted)',
    3: 'var(--color-accent-text)',
  };

  const positionColor = positionColors[driver.position as 1 | 2 | 3] || 'var(--color-muted)';

  return (
    <div className="relative rounded-xl bg-base/50 border border-line/50 p-3 text-center">
      <div
        className="absolute -top-3 left-1/2 -translate-x-1/2 z-10"
        style={{ color: positionColor }}
      >
        <span className="font-mono text-xl font-bold">
          {driver.position === 1 ? 'P1' : driver.position === 2 ? 'P2' : 'P3'}
        </span>
      </div>

      <div className="flex justify-center mb-2">
        <div
          className="h-16 w-16 shrink-0 rounded-full border-2 bg-raised object-cover object-top flex items-center justify-center"
          style={{ borderColor: driver.colour }}
        >
          {driver.headshotUrl ? (
            <img
              src={driver.headshotUrl}
              alt=""
              loading="lazy"
              className="h-full w-full rounded-full object-cover object-top"
            />
          ) : (
            <span className="font-mono text-lg font-semibold" style={{ color: driver.colour }}>
              {driver.code}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="font-medium text-sm text-ink truncate">{driver.name}</p>
        <p className="flex items-center justify-center gap-1 text-xs text-muted">
          <span aria-hidden="true" className="inline-block h-2 w-2 shrink-0 rounded" style={{ background: driver.colour }} />
          <span className="truncate">{driver.team}</span>
        </p>
      </div>

      {driver.points > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-base border border-line/50">
          <Trophy className="w-3 h-3 text-gold" />
          <span className="font-mono text-xs font-semibold text-gold">
            {driver.points} pts
          </span>
        </div>
      )}
    </div>
  );
}

function PodiumDisplay({ drivers }: { drivers: PodiumDriver[] }) {
  const sorted = [...drivers].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink uppercase tracking-wider">
        <Trophy className="w-4 h-4 text-gold" />FINAL CLASSIFICATION
      </div>
      <div className="grid grid-cols-3 gap-2">
        {sorted.map((driver) => (
          <PodiumCard key={driver.position} driver={driver} />
        ))}
      </div>
    </div>
  );
}

function getLabel(state: RaceState): string {
  if (typeof state === 'object' && state.type === 'yellow-flag-sector') {
    return `YELLOW FLAG - SECTOR ${state.sector}`;
  }
  if (typeof state === 'object' && state.type === 'red-flag') return 'RED FLAG';
  if (typeof state === 'object' && state.type === 'safety-car' && state.isRollingRestart) {
    return 'ROLLING RESTART';
  }

  const labels: Record<string, string> = {
    scheduled: 'Lights out in',
    upcoming: 'UPCOMING',
    unknown: 'UNKNOWN STATE',
    'lights-out-sequence': 'PREPARING START',
    'lights-out-countdown': "IT'S LIGHTS OUT",
    'in-progress': 'RACE IN PROGRESS',
    'yellow-flag': 'YELLOW FLAG',
    'yellow-flag-sector': 'YELLOW FLAG',
    'safety-car': 'SAFETY CAR',
    'safety-car-ending': 'SAFETY CAR IN THIS LAP',
    'red-flag': 'RED FLAG',
    'virtual-safety-car': 'VIRTUAL SAFETY CAR',
    'last-lap': 'LAST LAP',
    'chequered-flag': 'CHEQUERED FLAG',
    completed: 'RACE COMPLETED',
    'cancelled-by-host': 'CANCELLED',
  };

  const key = state as string;
  return labels[key] ?? 'UNKNOWN STATE';
}

function StatusBadge({ text, variant }: { text: string; variant: string }) {
  const toneClasses: Record<string, string> = {
    muted: 'bg-raised text-muted border-line',
    accent: 'bg-info/10 text-info border-info/30',
    warn: 'bg-warn/10 text-warn border-warn/30',
    ok: 'bg-ok/10 text-ok border-ok/30',
    bad: 'bg-accent/10 text-accent-text border-accent/40',
  };

  return (
    <div className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold uppercase tracking-widest ${toneClasses[variant] || toneClasses.muted}`}>
      {text}
    </div>
  );
}

function StartLights({ state, raceStartMs }: { state: RaceState; raceStartMs: number }) {
  const [now, setNow] = useState(Date.now());
  // Centisecond readout only for the lights-out countdown; every other readout changes once a second.
  const tickMs = state === 'lights-out-countdown' ? 10 : state === 'lights-out-sequence' ? 250 : 1000;
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);

  const delta = raceStartMs - now;
  const secondsLeft = delta / 1000;

  if (state === 'lights-out-sequence') {
    const isFlash = Math.floor(now / 500) % 2 === 0;
    return (
      <div className="flex gap-3 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-8 w-8 rounded-full transition-colors duration-200 ${(i % 2 !== 0 && isFlash) ? 'bg-accent shadow-[0_0_15px_var(--color-accent)]' : 'bg-raised'
              }`}
          />
        ))}
      </div>
    );
  }

  if (state === 'lights-out-countdown') {
    // The light sequence starts 5 seconds before raceStartMs.
    // If secondsLeft is 5, 0 lights are on. If 0, 5 lights are on.
    const lightsOn = Math.max(0, Math.min(5, Math.ceil(5 - secondsLeft)));
    const greenLight = lightsOn === 5 && secondsLeft <= 0;
    return (
      <div className="flex gap-3 mb-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`
              h-8 w-8 rounded-full transition-colors duration-300 
              ${greenLight
                ? 'bg-ok shadow-[0_0_15px_var(--color-ok)]'
                : i <= lightsOn
                  ? 'bg-accent shadow-[0_0_15px_var(--color-accent)]'
                  : 'bg-raised'
              }`}
          />
        ))}
      </div>
    );
  }

  return null;
}

function RaceTimer({ raceStartMs, state }: { raceStartMs: number; state: RaceState }) {
  const [now, setNow] = useState(Date.now());
  // Centiseconds are only shown in the lights-out countdown; every other readout changes once a
  // second, so a 250ms tick is plenty (it used to re-render every 10ms in every state).
  const tickMs = state === 'lights-out-countdown' ? 10 : 250;

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(timer);
  }, [tickMs]);

  const delta = raceStartMs - now;

  if (typeof state === 'object' && state.type === 'red-flag') {
    if (state.resumeAtMs == null) return null;
    const remaining = Math.ceil((state.resumeAtMs - now) / 1000);
    if (remaining <= 0) return null;
    const hours = Math.floor(remaining / 3600);
    const minutes = Math.floor((remaining % 3600) / 60);
    const seconds = remaining % 60;
    return (
      <div className="text-center">
        <span className="block font-mono text-xs uppercase tracking-widest text-muted">Resumes in</span>
        <span className="font-mono text-4xl font-bold tabular-nums text-ink">
          {hours > 0 ? `${String(hours).padStart(2, '0')}:` : ''}
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  if (state === 'scheduled' || state === 'upcoming') {
    const totalSeconds = Math.max(0, Math.floor(delta / 1000));

    if (totalSeconds >= 2592000) { // 30 days
      const months = Math.floor(totalSeconds / 2592000);
      const remaining = totalSeconds % 2592000;
      const days = Math.floor(remaining / 86400);
      return (
        <div className="font-mono text-4xl font-bold tabular-nums text-ink">
          {months}mo {days}d
        </div>
      );
    }

    if (totalSeconds >= 604800) { // 7 days
      const weeks = Math.floor(totalSeconds / 604800);
      const remaining = totalSeconds % 604800;
      const days = Math.floor(remaining / 86400);
      return (
        <div className="font-mono text-4xl font-bold tabular-nums text-ink">
          {weeks}w {days}d
        </div>
      );
    }

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const text = `${days > 0 ? `${days}d ` : ''}${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    return (
      <div className="font-mono text-4xl font-bold tabular-nums text-ink">
        {/* Timing-screen digit roll; the plain text stays available to assistive tech. */}
        <DigitRoll text={text} />
        <span className="sr-only">{text}</span>
      </div>
    );
  }

  if (state === 'unknown') return null;

  if (state === 'lights-out-countdown') {
    if (delta <= 0) {
      if (delta <= -30000) return null;

      return (
        <div className="font-mono text-2xl font-bold uppercase text-ink">
          And away we go
        </div>
      );
    }

    const totalSec = Math.max(0, delta / 1000);
    const s = Math.floor(totalSec % 60);
    const ms = Math.floor((delta % 1000) / 10);
    return (
      <div className="font-mono text-4xl font-bold tabular-nums text-ink">
        {String(s).padStart(2, '0')}.<span className="text-2xl opacity-70">{String(ms).padStart(2, '0')}</span>
      </div>
    );
  }

  // Every other state (in progress, flags, chequered, completed, cancelled) shows no timer.
  return null;
}

// Determine the tone for a given state
function getTone(state: RaceState): 'muted' | 'accent' | 'warn' | 'ok' | 'bad' {
  if (typeof state === 'object' && state.type === 'yellow-flag-sector') {
    return 'warn';
  }
  if (typeof state === 'object' && state.type === 'red-flag') return 'bad';

  switch (state) {
    case 'scheduled':
      return 'muted';
    case 'lights-out-sequence':
    case 'lights-out-countdown':
      return 'accent';
    case 'in-progress':
    case 'last-lap':
    case 'completed':
      return 'ok';
    case 'yellow-flag':
    case 'yellow-flag-sector':
    case 'safety-car':
    case 'safety-car-ending':
    case 'virtual-safety-car':
      return 'warn';
    case 'red-flag':
    case 'cancelled-by-host':
      return 'bad';
    case 'chequered-flag':
      return 'muted';
    default:
      return 'muted';
  }
}

export function RaceStateDisplay({
  state,
  raceStartMs,
  drivers,
  showStateBackground = true,
  greenFlagFramePlacement = 'local',
  onDisplayStateChange,
}: {
  state: RaceState;
  raceStartMs: number;
  drivers?: PodiumDriver[];
  showStateBackground?: boolean;
  greenFlagFramePlacement?: 'local' | 'viewport';
  onDisplayStateChange?: (state: RaceState) => void;
}) {
  const redFlagResumeAtMs = typeof state === 'object' && state.type === 'red-flag' ? state.resumeAtMs : undefined;
  const redFlagResumeProcedure = typeof state === 'object' && state.type === 'red-flag' ? state.resumeProcedure : undefined;
  const isStandingRedFlagRestart = redFlagResumeAtMs != null && redFlagResumeProcedure === 'standing';
  const [redFlagSequenceStarted, setRedFlagSequenceStarted] = useState(false);
  useEffect(() => {
    if (!isStandingRedFlagRestart || redFlagResumeAtMs == null) {
      setRedFlagSequenceStarted(false);
      return;
    }
    const remaining = redFlagResumeAtMs - Date.now() - 25000;
    if (remaining <= 0) {
      setRedFlagSequenceStarted(true);
      return;
    }
    const timer = window.setTimeout(() => setRedFlagSequenceStarted(true), remaining);
    return () => window.clearTimeout(timer);
  }, [isStandingRedFlagRestart, redFlagResumeAtMs]);

  const startSequenceTargetMs = state === 'lights-out-sequence'
    ? raceStartMs
    : isStandingRedFlagRestart && redFlagSequenceStarted
      ? redFlagResumeAtMs
      : undefined;
  const [lightsOutCountdownStarted, setLightsOutCountdownStarted] = useState(false);
  useEffect(() => {
    if (startSequenceTargetMs == null) {
      setLightsOutCountdownStarted(false);
      return;
    }

    const remaining = startSequenceTargetMs - Date.now() - 20000;
    if (remaining <= 0) {
      setLightsOutCountdownStarted(true);
      return;
    }

    const timer = window.setTimeout(() => setLightsOutCountdownStarted(true), remaining);
    return () => window.clearTimeout(timer);
  }, [startSequenceTargetMs]);

  const isLightsOutCountdown = state === 'lights-out-countdown' || (startSequenceTargetMs != null && lightsOutCountdownStarted);
  const countdownTargetMs = state === 'lights-out-countdown'
    ? raceStartMs
    : startSequenceTargetMs ?? raceStartMs;
  const [countdownComplete, setCountdownComplete] = useState(false);
  useEffect(() => {
    if (!isLightsOutCountdown) {
      setCountdownComplete(false);
      return;
    }
    const remaining = countdownTargetMs - Date.now();
    if (remaining <= 0) {
      setCountdownComplete(true);
      return;
    }
    setCountdownComplete(false);
    const timer = window.setTimeout(() => setCountdownComplete(true), remaining);
    return () => window.clearTimeout(timer);
  }, [countdownTargetMs, isLightsOutCountdown]);

  const [redFlagResumeComplete, setRedFlagResumeComplete] = useState(false);
  useEffect(() => {
    if (redFlagResumeAtMs == null) {
      setRedFlagResumeComplete(false);
      return;
    }
    const remaining = redFlagResumeAtMs - Date.now();
    if (remaining <= 0) {
      setRedFlagResumeComplete(true);
      return;
    }
    setRedFlagResumeComplete(false);
    const timer = window.setTimeout(() => setRedFlagResumeComplete(true), remaining);
    return () => window.clearTimeout(timer);
  }, [redFlagResumeAtMs]);

  const displayState: RaceState = redFlagResumeComplete
    ? redFlagResumeProcedure === 'rolling' ? { type: 'safety-car', isRollingRestart: true } : 'in-progress'
    : isStandingRedFlagRestart && redFlagSequenceStarted
      ? lightsOutCountdownStarted
        ? countdownComplete ? 'in-progress' : 'lights-out-countdown'
        : 'lights-out-sequence'
      : isLightsOutCountdown
        ? countdownComplete ? 'in-progress' : 'lights-out-countdown'
        : state;
  const displayRaceStartMs = redFlagResumeAtMs ?? raceStartMs;
  const [showRaceStartMessage, setShowRaceStartMessage] = useState(false);
  useEffect(() => {
    if (!isLightsOutCountdown || !countdownComplete) {
      setShowRaceStartMessage(false);
      return;
    }

    setShowRaceStartMessage(true);
    const timer = window.setTimeout(() => setShowRaceStartMessage(false), 30000);
    return () => window.clearTimeout(timer);
  }, [countdownComplete, isLightsOutCountdown]);

  const previousState = useRef(displayState);
  const [showGreenFlagClear, setShowGreenFlagClear] = useState(false);

  useEffect(() => {
    const wasCaution = isCautionState(previousState.current) || previousState.current === 'lights-out-countdown';
    previousState.current = displayState;

    if (displayState === 'in-progress' && wasCaution) {
      setShowGreenFlagClear(true);
      const timeout = window.setTimeout(() => setShowGreenFlagClear(false), 10000);
      return () => window.clearTimeout(timeout);
    }

    setShowGreenFlagClear(false);
  }, [displayState]);

  const previousPhaseState = useRef(displayState);
  const [showLightsOutTransition, setShowLightsOutTransition] = useState(false);
  useEffect(() => {
    const wasStartSequence = previousPhaseState.current === 'lights-out-sequence';
    previousPhaseState.current = displayState;

    if (displayState === 'lights-out-countdown' && wasStartSequence) {
      setShowLightsOutTransition(true);
      const timer = window.setTimeout(() => setShowLightsOutTransition(false), 900);
      return () => window.clearTimeout(timer);
    }

    setShowLightsOutTransition(false);
  }, [displayState]);

  useEffect(() => onDisplayStateChange?.(displayState), [displayState, onDisplayStateChange]);

  return (
    <div className="relative isolate flex flex-col items-center text-center space-y-4 z-10 w-full h-full overflow-hidden">
      {showStateBackground && <RaceStateBackdrop state={displayState} className="absolute inset-0 z-0" />}
      <div className="relative z-10 flex flex-col items-center text-center space-y-4 w-full">
        <StatusBadge text={getLabel(displayState)} variant={getTone(displayState)} />
        <StartLights state={displayState} raceStartMs={displayRaceStartMs} />
        {showRaceStartMessage
          ? <div className="font-mono text-2xl font-bold uppercase text-ink">And away we go</div>
          : <RaceTimer raceStartMs={displayRaceStartMs} state={displayState} />}
        {drivers && (displayState === 'completed' || displayState === 'chequered-flag') && (
          <PodiumDisplay drivers={drivers} />
        )}
      </div>
      {showLightsOutTransition && <div aria-hidden="true" className="lights-out-phase-transition" />}
      {showGreenFlagClear && (
        <div
          aria-hidden="true"
          className={`green-flag-transition ${greenFlagFramePlacement === 'viewport' ? 'green-flag-transition--viewport' : ''}`}
        />
      )}
    </div>
  );
}

export {
  PodiumDisplay,
  StatusBadge,
  RaceTimer,
  getLabel,
  getTone,
};