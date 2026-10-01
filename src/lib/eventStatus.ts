import { useEffect, useState } from 'react';
import type { DerivedStatus, EventConfig } from './types';

type StatusInput = Pick<EventConfig, 'opensAt' | 'closesAt' | 'override' | 'winnerRevealed'>;

export function deriveStatus(config: StatusInput, nowMs: number): DerivedStatus {
  if (config.winnerRevealed) return 'scored';
  if (config.override === 'closed' || nowMs >= config.closesAt.toMillis()) return 'closed';
  if (config.override === 'open' || nowMs >= config.opensAt.toMillis()) return 'open';
  return 'scheduled';
}

export function useEventStatus(config: StatusInput | null | undefined): DerivedStatus | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return config ? deriveStatus(config, now) : null;
}
