import { useEffect, useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { DUR, EASE, SPRING } from '../../lib/motion';
import type { QuestionCfg } from '../../lib/types';
import type { PickMap } from '../draft';

/** One start-light lamp: dark socket, red glow when lit. */
function Lamp({ lit, size = 'sm', delay = 0 }: { lit: boolean; size?: 'sm' | 'lg'; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <span
      className={`relative block shrink-0 rounded-full bg-base shadow-[inset_0_0_0_1px_var(--color-line)] ${size === 'lg' ? 'size-7 sm:size-9' : 'size-4 sm:size-[1.125rem]'}`}
    >
      <motion.span
        className="absolute inset-0 rounded-full bg-accent shadow-[0_0_14px_3px_rgb(216_30_54/0.55)]"
        initial={false}
        animate={{ opacity: +!!lit, scale: lit ? 1 : 0.7 }}
        transition={reduce ? { duration: 0 } : { duration: DUR.fast, ease: EASE.out, delay }}
      />
    </span>
  );
}

/** Progress rail: one lamp per call, lit once picked. With onJump each lamp is a button to that call. */
export function LightsRail({
  questions,
  answers,
  current,
  onJump,
}: {
  questions: QuestionCfg[];
  answers: PickMap;
  current: number;
  onJump?: (i: number) => void;
}) {
  return (
    <ol aria-label="Your calls" className="m-0 flex list-none flex-wrap items-center rounded-full border border-line bg-raised/70 p-0 px-1">
      {questions.map((q, i) => {
        const done = !!answers[q.id];
        const here = i === current;
        const label = `Call ${i + 1}: ${done ? 'picked' : 'no pick yet'}`;
        const dot = (
          <span className={`flex size-11 items-center justify-center rounded-full ${here ? 'bg-surface' : ''}`}>
            <span className={`rounded-full ${here ? 'outline-2 outline-offset-2 outline-ink' : ''}`}>
              <Lamp lit={done} />
            </span>
          </span>
        );
        return (
          <li key={q.id}>
            {onJump ? (
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={here ? 'step' : undefined}
                aria-label={label}
                className="block rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {dot}
              </button>
            ) : (
              <span aria-label={label} role="img">
                {dot}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** A row of lamps, `lit` of `count` on. Decorative. */
export function LampRow({ count = 5, lit = 0, size = 'lg' }: { count?: number; lit?: number; size?: 'sm' | 'lg' }) {
  return (
    <span className="inline-flex gap-2 rounded-full border border-line bg-raised/70 p-2 sm:gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Lamp key={i} lit={i < lit} size={size} />
      ))}
    </span>
  );
}

const STEP_MS = 260;

/** Lights-out moment: five lamps come on one by one, then go dark and the content rises in. Static under reduced motion. */
export function LightsOut({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const [lit, setLit] = useState(0);
  const [done, setDone] = useState(!!reduce);
  useEffect(() => {
    if (reduce) {
      setDone(true);
      return;
    }
    const ids: number[] = [];
    for (let i = 1; i <= 5; i++) ids.push(window.setTimeout(() => setLit(i), i * STEP_MS));
    ids.push(
      window.setTimeout(() => {
        setLit(0);
        setDone(true);
      }, 1900),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [reduce]);
  return (
    <div>
      <LampRow lit={lit} />
      <motion.div
        initial={false}
        animate={done ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
        transition={reduce ? { duration: 0 } : SPRING.pop}
        className="mt-6"
      >
        {children}
      </motion.div>
    </div>
  );
}
