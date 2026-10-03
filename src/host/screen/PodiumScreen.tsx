import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import type { RankedRow } from '../../lib/types';
import type { Stage } from './podium';
import Avatar from './Avatar';

interface StepProps {
  place: 1 | 2 | 3;
  row: RankedRow | null;
  revealed: boolean;
  active: boolean;
  totalQuestions: number;
  weighted?: boolean;
  heightClass: string;
  reduce: boolean;
}

const PLACE_LABEL: Record<1 | 2 | 3, string> = { 1: 'P1', 2: 'P2', 3: 'P3' };

function Step({ place, row, revealed, active, totalQuestions, weighted, heightClass, reduce }: StepProps) {
  const finale = place === 1 && active;
  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-[clamp(11rem,26vh,19rem)] items-end justify-center">
        <AnimatePresence mode="wait">
          {revealed && row ? (
            <motion.div
              key={row.uid}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={
                reduce
                  ? { duration: 0.3 }
                  : { type: 'spring', stiffness: 220, damping: finale ? 16 : 22, delay: 0.15 }
              }
              className="relative flex flex-col items-center gap-2 px-2 text-center"
            >
              {active && (
                <motion.div
                  aria-hidden="true"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 1, finale ? 0.9 : 0.6] }}
                  transition={{ duration: finale ? 1.4 : 0.8 }}
                  className="pointer-events-none absolute -inset-x-16 -top-24 -bottom-4 -z-10"
                  style={{
                    background:
                      'radial-gradient(ellipse 60% 70% at 50% 30%, var(--color-accent) 0%, transparent 70%)',
                    opacity: finale ? 0.35 : 0.2,
                  }}
                />
              )}
              {finale && !reduce && (
                <motion.span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-full"
                  initial={{ boxShadow: '0 0 0 0 color-mix(in srgb, var(--color-accent) 0%, transparent)' }}
                  animate={{
                    boxShadow: [
                      '0 0 0 0 color-mix(in srgb, var(--color-accent) 50%, transparent)',
                      '0 0 0 40px color-mix(in srgb, var(--color-accent) 0%, transparent)',
                      '0 0 0 0 color-mix(in srgb, var(--color-accent) 0%, transparent)',
                    ],
                  }}
                  transition={{ duration: 1.6, repeat: 2 }}
                />
              )}
              <Avatar
                photoUrl={row.photoURL}
                name={row.name}
                className={`${
                  finale
                    ? 'size-[clamp(6rem,14vw,11rem)] text-[clamp(1.5rem,3vw,2.5rem)]'
                    : 'size-[clamp(4.5rem,10vw,8rem)] text-[clamp(1.1rem,2vw,1.75rem)]'
                } border-2 border-accent`}
              />
              <p className="w-[clamp(6rem,16vw,12rem)] truncate text-[clamp(1.1rem,2.2vw,2.25rem)] font-semibold leading-tight">
                {row.name}
              </p>
              <p className="w-[clamp(6rem,16vw,12rem)] truncate font-mono text-[clamp(0.9rem,1.6vw,1.5rem)] tabular-nums text-accent-text">
                {row.score} of {totalQuestions} {weighted ? 'points' : 'correct'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="sealed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <span className="grid size-[clamp(4.5rem,10vw,8rem)] place-items-center rounded-full border border-dashed border-line font-mono text-[clamp(1.5rem,3vw,2.5rem)] text-muted">
                ?
              </span>
              <p className="w-[clamp(6rem,16vw,12rem)] text-[clamp(0.9rem,1.4vw,1.25rem)] text-muted">
                Empty grid slot
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <motion.div
        layout
        initial={reduce ? { opacity: 0 } : { opacity: 0, scaleY: 0 }}
        animate={{ opacity: revealed ? (active ? 1 : 0.65) : 0.35, scaleY: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{ transformOrigin: 'bottom' }}
        className={`flex w-[clamp(6rem,16vw,12rem)] flex-col items-center justify-start rounded-t-xl border border-line bg-raised pt-3 ${heightClass}`}
      >
        <span className="font-mono text-[clamp(1.5rem,3.5vw,3rem)] font-bold tabular-nums text-muted">
          {PLACE_LABEL[place]}
        </span>
      </motion.div>
    </div>
  );
}

export default function PodiumScreen({
  p1,
  p2,
  p3,
  stage,
  totalQuestions,
  weighted,
}: {
  p1: RankedRow | null;
  p2: RankedRow | null;
  p3: RankedRow | null;
  stage: Stage;
  totalQuestions: number;
  weighted?: boolean;
}) {
  const reduce = !!useReducedMotion();
  const activeSlot: 'p3' | 'p2' | 'p1' | null = stage === 1 ? 'p3' : stage === 2 ? 'p2' : stage === 3 ? 'p1' : null;

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-10 overflow-hidden px-6 py-16">
      {/* Ambient wash so a mostly-empty screen still reads as a lit stage, not flat black —
         a single wide, faint radial glow, well under the one-accent budget. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 50% 65%, color-mix(in srgb, var(--color-accent) 10%, transparent) 0%, transparent 70%)',
        }}
      />
      <p className="absolute top-10 left-1/2 -translate-x-1/2 text-[clamp(0.9rem,1.8vw,1.5rem)] uppercase tracking-[0.3em] text-muted">
        Podium
      </p>
      <div className="flex items-end justify-center gap-4 md:gap-8">
        <Step
          place={2}
          row={p2}
          revealed={stage >= 2}
          active={activeSlot === 'p2'}
          totalQuestions={totalQuestions}
          weighted={weighted}
          heightClass="h-[clamp(6rem,16vh,11rem)]"
          reduce={reduce}
        />
        <Step
          place={1}
          row={p1}
          revealed={stage >= 3}
          active={activeSlot === 'p1'}
          totalQuestions={totalQuestions}
          weighted={weighted}
          heightClass="h-[clamp(8rem,22vh,15rem)]"
          reduce={reduce}
        />
        <Step
          place={3}
          row={p3}
          revealed={stage >= 1}
          active={activeSlot === 'p3'}
          totalQuestions={totalQuestions}
          weighted={weighted}
          heightClass="h-[clamp(4.5rem,12vh,8rem)]"
          reduce={reduce}
        />
      </div>
    </div>
  );
}
