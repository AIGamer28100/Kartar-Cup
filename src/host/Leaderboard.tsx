import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from '@phosphor-icons/react';
import Button from '../components/Button';
import { QUESTIONS } from '../config/event';
import { QUESTION_IDS } from '../lib/types';
import type { RankedRow } from '../lib/types';

const spring = { type: 'spring', stiffness: 380, damping: 34 } as const;

export default function Leaderboard({
  rows,
  overrideUid,
  canPick,
  onPick,
}: {
  rows: RankedRow[];
  overrideUid: string | null;
  canPick: boolean;
  onPick: (uid: string | null) => void;
}) {
  const [pending, setPending] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <section aria-label="Leaderboard" className="py-16">
        <p className="text-3xl text-muted">No picks yet, the grid is quiet.</p>
      </section>
    );
  }
  const top = rows[0].score;

  return (
    <section aria-label="Leaderboard" className="py-8">
      <h2 className="text-3xl font-semibold">Leaderboard</h2>
      <ol className="mt-4 divide-y divide-line">
        {rows.map((r) => {
          const tiedTop = canPick && r.tiedOnScore && r.score === top;
          const chosen = overrideUid === r.uid;
          const inner = (
            <>
              <span className="w-10 shrink-0 text-left font-mono text-2xl tabular-nums text-muted md:w-16 md:text-4xl">
                {r.rank}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-[2rem] font-semibold leading-tight md:text-5xl">
                {r.name}
                {chosen && (
                  <span className="ml-3 align-middle text-sm font-normal uppercase tracking-widest text-accent">
                    tiebreak
                  </span>
                )}
              </span>
              <span
                className="hidden shrink-0 gap-1 sm:flex"
                role="img"
                aria-label={QUESTIONS.map(
                  (_q, i) => `${i + 1} ${r.ticks[QUESTION_IDS[i]] ? 'right' : 'wrong'}`,
                ).join(', ')}
              >
                {QUESTION_IDS.map((id, i) => (
                  <span
                    key={id}
                    title={QUESTIONS[i].prompt}
                    className={`grid size-9 place-items-center rounded-md border ${
                      r.ticks[id] ? 'border-accent text-accent' : 'border-line text-muted'
                    }`}
                  >
                    {r.ticks[id] ? (
                      <Check size={20} weight="regular" />
                    ) : (
                      <X size={16} weight="regular" />
                    )}
                  </span>
                ))}
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-4xl tabular-nums md:w-24 md:text-6xl">
                {r.score}
              </span>
            </>
          );
          const rowCls = 'flex w-full items-center gap-3 py-4 md:gap-6 md:py-5';
          return (
            <motion.li key={r.uid} layout transition={spring}>
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
