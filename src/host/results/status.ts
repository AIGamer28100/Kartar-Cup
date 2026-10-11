import type { PullOutcome, PullPlan } from '../../lib/raceResults';
import { MAX_PULL_ATTEMPTS } from '../../lib/raceResults';

/** What the last automatic or manual pull found. */
export interface LastPull {
  pulledMs: number;
  attempts: number;
  outcome: PullOutcome | 'error';
  found: number;
  total: number;
  reason?: string;
}

/** "14:22 IST" - results are read by the Indian host team. */
export function istTime(ms: number): string {
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(ms);
  return `${t} IST`;
}

/** "1:05" from a millisecond count (rounded up to the second). */
export function clockLeft(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The one line the host reads under the results heading (R65). */
export function statusLine(plan: PullPlan, raceEndMs: number, last: LastPull | null, pulling: boolean): string {
  const finishes = `Race finishes ${istTime(raceEndMs)}.`;
  if (plan.state === 'waiting') {
    return `${finishes} OpenF1 data is available from ${istTime(plan.dataFromMs)}. Answers are pulled automatically once this page is open then.`;
  }
  const head = `Race finished ${istTime(raceEndMs)}. OpenF1 data is available from ${istTime(plan.dataFromMs)}.`;
  if (plan.state === 'blackout') return `${head} Available in ${clockLeft(plan.msLeft)}.`;
  if (pulling) return `${head} Pulling now...`;
  if (!last) return head;
  const got = `Pulled ${istTime(last.pulledMs)}, ${last.found} of ${last.total} answers found.`;
  if (plan.state === 'ready') return `${head} ${got} Review and publish.`;
  if (plan.state === 'retrying') {
    return `${head} ${got} Some data is still missing, retrying in ${clockLeft(plan.msLeft)} (attempt ${last.attempts} of ${MAX_PULL_ATTEMPTS}).`;
  }
  if (plan.state === 'stopped') return `${head} ${got} Stopped after ${MAX_PULL_ATTEMPTS} attempts, press Pull now to try again.`;
  return head;
}
