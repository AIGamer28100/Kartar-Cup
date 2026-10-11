import type { LiveLapSource } from './types';

/** The FREE source: OpenF1 has no data around a live session, so the host types the lap in the console. */
export const manualSource: LiveLapSource = {
  id: 'manual',
  label: 'Manual (host types the current lap)',
  configured: () => true,
  fetchLap: async () => null,
};
