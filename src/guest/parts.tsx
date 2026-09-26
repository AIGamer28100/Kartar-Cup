import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, WhatsappLogo, X } from '@phosphor-icons/react';
import { WHATSAPP_COMMUNITY_URL, QUESTIONS, optionsFor } from '../config/event';
import type { Answers, QuestionId } from '../lib/types';
import { QUESTION_IDS } from '../lib/types';
import Divider from '../components/Divider';

export const SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const;

/** Staggered spring reveal wrapper (transform + opacity only). */
export function Reveal({
  children,
  index = 0,
  className = '',
}: {
  children: ReactNode;
  index?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING, delay: reduce ? 0 : index * 0.07 }}
    >
      {children}
    </motion.div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-6 pb-10 pt-10">
      {children}
    </main>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-widest text-muted">{children}</p>
  );
}

export function WhatsAppCta() {
  if (!WHATSAPP_COMMUNITY_URL) return null;
  return (
    <a
      href={WHATSAPP_COMMUNITY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-raised px-5 text-base font-medium text-ink transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98]"
    >
      <WhatsappLogo size={22} weight="regular" aria-hidden="true" />
      Join The Karter Cup WhatsApp community
    </a>
  );
}

export function optionLabel(qid: QuestionId, id: string | undefined): string {
  const q = QUESTIONS.find((x) => x.id === qid);
  if (!q || !id) return 'No pick';
  return optionsFor(q).find((o) => o.id === id)?.label ?? id;
}

export function PicksList({ answers }: { answers: Partial<Answers> }) {
  return (
    <ol className="m-0 list-none p-0">
      {QUESTIONS.map((q, i) => (
        <li key={q.id}>
          {i > 0 && <Divider />}
          <div className="py-4">
            <p className="text-sm text-muted">
              <span className="font-mono tabular-nums">{i + 1}</span>. {q.prompt}
            </p>
            <p className="mt-1 text-lg font-medium text-ink">{optionLabel(q.id, answers[q.id])}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TickStrip({ ticks }: { ticks: Record<QuestionId, boolean> }) {
  return (
    <ul className="m-0 flex list-none gap-2 p-0" aria-label="Correct answers">
      {QUESTION_IDS.map((id, i) => (
        <li
          key={id}
          className={`flex size-11 items-center justify-center rounded-lg border font-mono text-sm ${
            ticks[id] ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'
          }`}
        >
          <span className="sr-only">
            Question {i + 1}: {ticks[id] ? 'correct' : 'missed'}
          </span>
          {ticks[id] ? (
            <Check size={20} weight="regular" aria-hidden="true" />
          ) : (
            <X size={20} weight="regular" aria-hidden="true" />
          )}
        </li>
      ))}
    </ul>
  );
}
