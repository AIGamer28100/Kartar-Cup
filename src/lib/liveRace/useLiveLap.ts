import { useEffect, useRef } from 'react';
import { createLapPoller } from './lapPoller';
import type { LiveLapSource } from './types';

interface UseLiveLapOptions {
  source: LiveLapSource;
  enabled: boolean;
  intervalMs?: number;
  /** Called only when the lap number increases. */
  onLap: (lap: number) => void;
}

/** Polls `source` while enabled and the tab is visible; see createLapPoller for the guarantees. */
export function useLiveLap({ source, enabled, intervalMs = 5000, onLap }: UseLiveLapOptions): void {
  const onLapRef = useRef(onLap);
  useEffect(() => {
    onLapRef.current = onLap;
  });

  useEffect(() => {
    if (!enabled) return;
    const poller = createLapPoller({ source, intervalMs, onLap: (lap) => onLapRef.current(lap) });
    const onVisibility = () => poller.resume();
    document.addEventListener('visibilitychange', onVisibility);
    poller.start();
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      poller.stop();
    };
  }, [source, enabled, intervalMs]);
}
