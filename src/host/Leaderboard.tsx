import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from '@phosphor-icons/react';
import Button from '../components/Button';
import { QUESTIONS } from '../config/event';
import { pointsOf } from '../lib/scoring';
import type { QuestionCfg, RankedRow } from '../lib/types';

// Host tools stay low-motion (R20): a quick linear reorder, no spring bounce.
const reorder = { duration: 0.18, ease: 'easeOut' } as const;

export default function Leaderboard({
  rows,
  overrideUid,
  canPick,
  questions,
  onPick,
}: {
  rows: RankedRow[];
  overrideUid: string | null;
  canPick: boolean;
  /** The live event's questions (ids, prompts, points); absent falls back to the original five. */
  questions?: QuestionCfg[];
  onPick: (uid: string | null) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section aria-label="Leaderboard" className="py-16">
        <p className="text-2xl text-muted">No picks yet, the grid is quiet.</p>
      </section>
    );
  }
  const top = rows[0].score;
  const qs: QuestionCfg[] = questions ?? QUESTIONS;

  return (
    <section aria-label="Leaderboard" className="py-8">
      <h2 className="text-2xl font-semibold">Leaderboard</h2>
      <ol className="mt-4 divide-y divide-line">
        {rows.map((r) => {
          const tiedTop = canPick && r.tiedOnScore && r.score === top;
          const chosen = overrideUid === r.uid;
          const inner = (
            <>
              <span className="text-left font-mono text-xl tabular-nums text-muted md:text-3xl 2xl:text-4xl">
                {r.rank}
              </span>
              <span className="min-w-0 truncate text-left text-[1.375rem] font-semibold leading-tight md:text-4xl 2xl:text-5xl">
                {r.name}
                {chosen && (
                  <span className="ml-3 align-middle text-sm font-normal uppercase tracking-widest text-accent-text">
                    tiebreak
                  </span>
                )}
              </span>
              <span
                className="hidden gap-1.5 sm:flex"
                role="img"
                aria-label={qs
                  .map((q, i) => `${i + 1} ${r.ticks[q.id] ? 'right' : 'wrong'}${pointsOf(q) > 1 ? ` (${pointsOf(q)} points)` : ''}`)
                  .join(', ')}
              >
                {qs.map((q) => (
                  <span
                    key={q.id}
                    title={pointsOf(q) > 1 ? `${q.prompt} (${pointsOf(q)} points)` : q.prompt}
                    className={`grid size-9 place-items-center rounded-md border ${
                      r.ticks[q.id] ? 'border-accent text-accent-text' : 'border-line text-muted'
                    }`}
                  >
                    {r.ticks[q.id] ? (
                      <Check size={20} weight="regular" />
                    ) : (
                      <X size={16} weight="regular" />
                    )}
                  </span>
                ))}
              </span>
              <span className="text-right font-num text-4xl font-extrabold italic tabular-nums text-gold md:text-6xl 2xl:text-7xl">
                {r.score}
                {(r.bonus ?? 0) > 0 && (
                  <span className="block text-xs text-muted md:text-sm 2xl:text-base">
                    {r.quizScore ?? 0} + {r.bonus} card
                  </span>
                )}
              </span>
            </>
          );
          const rowCls =
            'grid w-full grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-x-3 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto_4.5rem] md:grid-cols-[4rem_minmax(0,1fr)_auto_6rem] md:gap-x-6 md:py-5 2xl:grid-cols-[6rem_minmax(0,1fr)_auto_8rem] 2xl:py-6';
          return (
            <motion.li key={r.uid} layout transition={reorder}>
              {tiedTop ? (
                <button
                  type="button"
                  onClick={() => setPending(pending === r.uid ? null : r.uid)}
                  aria-label={`${r.name}, tied on ${r.score}. Set as tiebreak winner`}
                  className={`${rowCls} transition duration-150 hover:bg-raised active:scale-[0.995] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                >
                  {inner}
                </button>
              ) : (
                <div className={rowCls}>{inner}</div>
              )}
              {pending === r.uid && (
                <div className="flex flex-wrap items-center gap-3 pb-4" role="group">
                  <p className="text-lg">
                    {chosen ? 'Clear the tiebreak on' : 'Give the tiebreak to'} {r.name}?
                  </p>
                  <Button
                    onClick={() => {
                      onPick(chosen ? null : r.uid);
                      setPending(null);
                    }}
                  >
                    Confirm
                  </Button>
                  <Button variant="ghost" onClick={() => setPending(null)}>
                    Cancel
                  </Button>
                </div>
              )}
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
