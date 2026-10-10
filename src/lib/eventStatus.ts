import { useEffect, useState } from 'react';
import { quizIsClosed } from './quizWindow';
import type { DerivedStatus, EventConfig } from './types';

type StatusInput = Pick<
  EventConfig,
  'opensAt' | 'closesAt' | 'override' | 'winnerRevealed' | 'totalLaps' | 'liveLap' | 'delayed' | 'raceStartedAt'
>;

/** scored > closed (host, lap count or clock, see quizIsClosed) > open > scheduled. */
export function deriveStatus(config: StatusInput, nowMs: number): DerivedStatus {
  if (config.winnerRevealed) return 'scored';
  if (quizIsClosed(config, nowMs)) return 'closed';
  // A host 'open' override opens the quiz at any time (R61 amended); only the close rules can stop it.
  if (config.override === 'open' || nowMs >= config.opensAt.toMillis()) return 'open';
  return 'scheduled';
}

/** Wall clock ticking every second. */
export function useNowMs(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useEventStatus(config: StatusInput | null | undefined): DerivedStatus | null {
  const now = useNowMs();
  return config ? deriveStatus(config, now) : null;
}
