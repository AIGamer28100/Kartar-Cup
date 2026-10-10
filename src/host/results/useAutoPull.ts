import { useEffect, useRef, useState } from 'react';
import { openF1IdsFor } from '../../config/tracks/openf1Ids';
import { fetchSessions } from '../../lib/raceData';
import { nextResultsPull, type PullOutcome, type PullPlan } from '../../lib/raceResults';
import type { LastPull } from './status';

interface Options {
  enabled: boolean;
  raceId?: string;
  startMs: number;
  durationMin: number;
  /** One pull into the draft (never publishes, never overwrites a hand-edited answer). */
  pullOnce: () => Promise<{ outcome: PullOutcome | 'error'; found: number; total: number; reason?: string }>;
}

/** When the race ended: OpenF1's own end of the Race session when known, else start + duration. */
const endOr = (startMs: number, durationMin: number, actual: number | null): number =>
  typeof actual === 'number' && Number.isFinite(actual) ? actual : startMs + durationMin * 60_000;

/** R65: after race end + 30 min (OpenF1 blackout) pull once, then retry every 2 min up to 10 times until
 * every dataset is in. Fills the draft only; publishing stays the host's Save results. */
export function useAutoPull(o: Options) {
  const [now, setNow] = useState(() => Date.now());
  const [actualEnd, setActualEnd] = useState<number | null>(null);
  const [last, setLast] = useState<LastPull | null>(null);
  const [pulling, setPulling] = useState(false);
  const busy = useRef(false);
  const attempts = useRef(0);
  const pullRef = useRef(o.pullOnce);
  pullRef.current = o.pullOnce;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const scheduledEnd = endOr(o.startMs, o.durationMin, null);
  const raceOver = now >= scheduledEnd;
  const meetingKey = o.raceId ? openF1IdsFor(o.raceId)?.meetingKey : undefined;

  // Once the race should be over, ask OpenF1 for the real end of the Race session (red flags stretch it).
  useEffect(() => {
    if (!o.enabled || !raceOver || meetingKey == null) return;
    let live = true;
    fetchSessions(meetingKey).then(
      (ss) => {
        const race = ss.find((s) => s.type === 'Race' && !s.cancelled);
        const end = race ? Date.parse(race.endUtc) : NaN;
        if (live && Number.isFinite(end)) setActualEnd(end);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [o.enabled, raceOver, meetingKey]);

  const raceEndMs = endOr(o.startMs, o.durationMin, actualEnd);
  const plan: PullPlan = nextResultsPull({
    raceEndMs,
    now,
    lastPullMs: last?.pulledMs ?? null,
    lastOutcome: last ? (last.outcome === 'error' ? 'none' : last.outcome) : null,
    attempts: attempts.current,
  });

  async function run() {
    if (busy.current) return;
    busy.current = true;
    setPulling(true);
    try {
      const r = await pullRef.current();
      attempts.current += 1;
      setLast({ pulledMs: Date.now(), attempts: attempts.current, ...r });
    } finally {
      busy.current = false;
      setPulling(false);
    }
  }

  useEffect(() => {
    if (o.enabled && plan.state === 'pull' && !busy.current) void run();
  }, [o.enabled, plan.state]);

  /** Manual "Pull now": always allowed, counts as an attempt. */
  return { plan, raceEndMs, last, pulling, pullNow: run };
}
