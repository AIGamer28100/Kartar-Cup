import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Trophy } from '@phosphor-icons/react';
import Button from '../components/Button';
import { revealWinner } from '../lib/db';
import type { RankedRow } from '../lib/types';

// Host tools stay low-motion (R20): quick opacity/transform fade, no spring bounce.
const fast = { duration: 0.18, ease: 'easeOut' } as const;

export default function RevealWinner({
  winner,
  overrideUid,
  revealed,
}: {
  winner: RankedRow | null;
  overrideUid: string | null;
  revealed: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const reduce = useReducedMotion();

  async function reveal() {
    setBusy(true);
    setErr(null);
    try {
      await revealWinner(overrideUid);
      setShow(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Reveal failed. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const item = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: reduce ? { duration: 0.01 } : { ...fast, delay: delay * 0.08 },
  });

  return (
    <section aria-label="Winner" className="border-t border-line py-8">
      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={busy || !winner} onClick={reveal}>
          <Trophy size={20} weight="regular" />
          {revealed ? 'Replay the reveal' : 'Reveal the winner'}
        </Button>
        {!winner && <p className="text-muted">Nobody to crown yet.</p>}
      </div>
      {err && (
        <p role="alert" className="mt-3 text-accent">
          {err}
        </p>
      )}
      <AnimatePresence>
        {show && winner && (
          <motion.div
            role="dialog"
            aria-label="Winner"
            className="fixed inset-0 z-50 grid place-items-center bg-base p-6 md:p-16 lg:p-24"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="max-w-full text-left">
              <motion.p
                {...item(0.1)}
                className="text-xl uppercase tracking-widest text-muted md:text-3xl"
              >
                Chequered flag. Your winner
              </motion.p>
              <motion.p
                {...item(0.5)}
                className="mt-6 break-words text-[clamp(2.5rem,9vw,8rem)] font-semibold leading-none"
              >
                {winner.name}
              </motion.p>
              <motion.p
                {...item(1)}
                className="mt-6 font-mono text-5xl tabular-nums text-accent md:text-6xl"
              >
                {winner.score} / 5
              </motion.p>
              <motion.div {...item(1.5)} className="mt-10">
                <Button variant="secondary" onClick={() => setShow(false)}>
                  Back to the pit wall
                </Button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
