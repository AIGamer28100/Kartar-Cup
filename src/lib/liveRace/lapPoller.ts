import { LiveNotConfiguredError, type LiveLapSource } from './types';

export interface LapPollerOptions {
  source: LiveLapSource;
  intervalMs: number;
  onLap: (lap: number) => void;
  /** Injectable for tests; default reads document.hidden. */
  isHidden?: () => boolean;
}

const MAX_BACKOFF_MS = 60_000;

/** Sequential poller: one request at a time, paused while hidden, exponential backoff on failure,
 * calls onLap only when the lap number increases, and stops for good on LiveNotConfiguredError. */
export function createLapPoller(opts: LapPollerOptions) {
  const isHidden = opts.isHidden ?? (() => typeof document !== 'undefined' && document.hidden);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let inFlight = false;
  let failures = 0;
  let lastLap: number | null = null;
  let abort: AbortController | null = null;

  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const schedule = (ms: number) => {
    clear();
    if (running) timer = setTimeout(tick, ms);
  };

  async function tick() {
    timer = null;
    if (!running || inFlight) return;
    if (isHidden()) return; // resume() re-arms us when the tab is visible again
    inFlight = true;
    abort = new AbortController();
    try {
      const snap = await opts.source.fetchLap(abort.signal);
      if (!running) return;
      if (snap && typeof snap.lap === 'number') {
        failures = 0;
        if (lastLap === null || snap.lap > lastLap) {
          lastLap = snap.lap;
          opts.onLap(snap.lap);
        }
      } else {
        failures++;
      }
    } catch (e) {
      if (e instanceof LiveNotConfiguredError) {
        running = false;
        return;
      }
      failures++;
    } finally {
      inFlight = false;
    }
    schedule(failures ? Math.min(opts.intervalMs * 2 ** failures, MAX_BACKOFF_MS) : opts.intervalMs);
  }

  return {
    start() {
      if (running) return;
      running = true;
      void tick();
    },
    /** Call on visibilitychange: re-arms polling if we paused while hidden. */
    resume() {
      if (running && !timer && !inFlight && !isHidden()) void tick();
    },
    stop() {
      running = false;
      clear();
      abort?.abort();
    },
  };
}
