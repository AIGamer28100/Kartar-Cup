import { motion, useReducedMotion } from 'framer-motion';
import { quizClosesAtMs } from '../../lib/quizWindow';
import type { EventConfig } from '../../lib/types';
import { useCountdown } from '../../lib/useCountdown';
import { formatRemaining } from '../model';
import { lapLine, urgency } from './logic';

const TONE = {
  calm: 'border-line bg-raised text-muted',
  soon: 'border-accent/60 bg-accent/10 text-ink',
  final: 'border-accent bg-accent/20 text-ink',
};

/** "Closes in 12:30" HUD pill while open; "Race delayed" while the deadline is held; lap line beneath. */
export function ClosePill({ config, className = '' }: { config: EventConfig; className?: string }) {
  const reduce = useReducedMotion();
  const at = quizClosesAtMs(config);
  const { totalMs } = useCountdown(at);
  const held = at === null;
  const laps = held ? null : lapLine(config);
  const tone = held ? 'calm' : urgency(totalMs);
  const pulse = tone === 'final' && !reduce;
  return (
    <div className={`flex flex-col items-end gap-1 ${className}`}>
      <p className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 font-mono text-xs uppercase tracking-widest ${TONE[tone]}`}>
        <motion.span
          aria-hidden="true"
          className={`size-2 shrink-0 rounded-full ${held ? 'bg-warn' : 'bg-accent'}`}
          animate={pulse ? { opacity: [1, 0.25, 1] } : { opacity: 1 }}
          transition={pulse ? { duration: 1, repeat: 60 } : { duration: 0 }}
        />
        {held ? (
          <span>Race delayed</span>
        ) : totalMs > 0 ? (
          <>
            <span>Closes in</span>
            <span role="timer" className="text-sm tabular-nums text-ink">
              {formatRemaining(totalMs)}
            </span>
          </>
        ) : (
          <span>Pit lane closing</span>
        )}
      </p>
      {laps && <p className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">{laps}</p>}
    </div>
  );
}

/** "Opens in 04:12" HUD pill for the lobby. */
export function OpensPill({ opensAt }: { opensAt: number }) {
  const { totalMs } = useCountdown(opensAt);
  return (
    <p className="inline-flex min-h-9 items-center gap-2 rounded-full border border-line bg-raised px-3 font-mono text-xs uppercase tracking-widest text-muted">
      <span className="size-2 shrink-0 rounded-full bg-surface ring-1 ring-muted" aria-hidden="true" />
      <span>Opens in</span>
      <span role="timer" className="text-sm tabular-nums text-ink">
        {formatRemaining(totalMs)}
      </span>
    </p>
  );
}
