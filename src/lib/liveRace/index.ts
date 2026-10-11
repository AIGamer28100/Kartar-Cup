import { manualSource } from './manualSource';
import { openf1LiveSource } from './openf1LiveSource';
import type { LiveLapSource } from './types';

export type { LiveLapSnapshot, LiveLapSource } from './types';
export { LiveNotConfiguredError } from './types';
export { useLiveLap } from './useLiveLap';

export const LIVE_LAP_SOURCES: LiveLapSource[] = [manualSource, openf1LiveSource];

/** Default is manual. openf1-live only when it is configured (VITE_OPENF1_LIVE_URL set) AND preferred. */
export function pickLiveLapSource(preferId?: string): LiveLapSource {
  const preferred = LIVE_LAP_SOURCES.find((s) => s.id === preferId);
  return preferred && preferred.id !== 'manual' && preferred.configured() ? preferred : manualSource;
}
