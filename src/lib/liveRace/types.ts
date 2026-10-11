export interface LiveLapSnapshot {
  /** Current race lap, or null when the source has no lap (e.g. manual entry, or no laps in the window). */
  lap: number | null;
  sessionKey?: number;
  updatedAtMs: number;
  source: 'manual' | 'openf1-live';
}

export interface LiveLapSource {
  id: 'manual' | 'openf1-live';
  label: string;
  /** True when this source can be used right now (e.g. its Worker URL is configured). */
  configured(): boolean;
  /** Latest lap, or null when unavailable. May throw LiveNotConfiguredError. */
  fetchLap(signal?: AbortSignal): Promise<LiveLapSnapshot | null>;
}

/** The Worker answered 503 {configured:false}: paid access is not switched on server-side. */
export class LiveNotConfiguredError extends Error {
  readonly code = 'not-configured';
  constructor() {
    super('OpenF1 live access is not configured');
    this.name = 'LiveNotConfiguredError';
  }
}
