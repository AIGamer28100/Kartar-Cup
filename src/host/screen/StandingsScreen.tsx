import { motion, useReducedMotion } from 'framer-motion';
import { Check, X } from '@phosphor-icons/react';
import type { EventConfig, RankedRow } from '../../lib/types';
import Avatar from './Avatar';

/** Full leaderboard for the big screen. Real name + Avatar + score + tick strip only — never
 * email/phone (R15/privacy), same discipline as the host's own Leaderboard component. */
export default function StandingsScreen({ config, ranked }: { config: EventConfig; ranked: RankedRow[] }) {
  const reduce = useReducedMotion();

  if (ranked.length === 0) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-[clamp(1.5rem,4vw,3rem)] text-muted">No picks yet. The grid is quiet.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col px-8 py-10 md:px-16">
      <motion.h1
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-[clamp(1.5rem,3.5vw,3rem)] font-semibold"
      >
        {config.name} · Standings
      </motion.h1>
      <ol className="mt-6 flex-1 divide-y divide-line overflow-hidden">
        {ranked.map((r, i) => (
          <motion.li
            key={r.uid}
            layout
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
            className="grid grid-cols-[clamp(2.5rem,5vw,4rem)_auto_1fr_auto_auto] items-center gap-x-4 py-3 md:gap-x-6 md:py-4"
          >
            <span className="font-mono text-[clamp(1.25rem,2.5vw,2.5rem)] tabular-nums text-muted">
              {r.rank}
            </span>
            <Avatar photoUrl={r.photoURL} name={r.name} className="size-[clamp(2.5rem,4.5vw,4rem)] text-[clamp(0.85rem,1.2vw,1.25rem)]" />
            <span className="min-w-0 truncate text-[clamp(1.1rem,2.6vw,2.5rem)] font-semibold">
              {r.name}
            </span>
            <span
              className="hidden gap-1.5 sm:flex"
              role="img"
              aria-label={config.questionIds.map((id, i2) => `${i2 + 1} ${r.ticks[id] ? 'right' : 'wrong'}`).join(', ')}
            >
              {config.questionIds.map((id) => (
                <span
                  key={id}
                  className={`grid size-[clamp(1.5rem,2vw,2.25rem)] place-items-center rounded-md border ${
                    r.ticks[id] ? 'border-accent text-accent-text' : 'border-line text-muted'
                  }`}
                >
                  {r.ticks[id] ? <Check size={18} weight="regular" /> : <X size={14} weight="regular" />}
                </span>
              ))}
            </span>
            <span className="text-right font-mono text-[clamp(1.5rem,3vw,3.5rem)] tabular-nums text-accent-text">
              {r.score}
            </span>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}
