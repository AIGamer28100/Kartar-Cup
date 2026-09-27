import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, WhatsappLogo, X } from '@phosphor-icons/react';
import type { EventConfig } from '../lib/types';
import { useCountdown } from '../lib/useCountdown';
import Divider from '../components/Divider';
import type { PickMap } from './draft';
import { formatRemaining, optionLabel, safeWhatsappUrl } from './model';

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
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-[87.5rem] flex-col px-6 pb-10 pt-10 md:px-10 md:py-14 lg:px-16">
      {children}
    </main>
  );
}

export const H1 = 'text-[clamp(2.25rem,4.5vw,4.5rem)] font-semibold leading-[1.02] tracking-tight';

/** Split composition: stacked on phones, two columns from md. Left = readout, right = active step. */
export function Split({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="grid flex-1 content-start gap-10 md:grid-cols-2 md:content-center md:items-start md:gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-24">
      <div className="flex min-w-0 flex-col">{left}</div>
      <div className="flex min-w-0 flex-col">{right}</div>
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-widest text-muted">{children}</p>
  );
}

export function WhatsAppCta({ url }: { url: string | undefined }) {
  const href = safeWhatsappUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-raised px-5 text-[1rem] font-medium text-ink transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98]"
    >
      <WhatsappLogo size={22} weight="regular" aria-hidden="true" />
      Join The Karter Cup WhatsApp community
    </a>
  );
}

/** Slim mono "Picks close in mm:ss" line for the open window. */
export function CloseTimer({ closesAt, className = '' }: { closesAt: number; className?: string }) {
  const { totalMs } = useCountdown(closesAt);
  return (
    <p className={`flex items-baseline gap-2 font-mono text-xs uppercase tracking-widest text-muted ${className}`}>
      <span>Picks close in</span>
      <span role="timer" className="text-sm tabular-nums text-ink">
        {formatRemaining(totalMs)}
      </span>
    </p>
  );
}

export function PicksList({ config, answers }: { config: EventConfig; answers: PickMap }) {
  return (
    <ol className="m-0 list-none p-0">
      {config.questions.map((q, i) => (
        <li key={q.id}>
          {i > 0 && <Divider />}
          <div className="py-4">
            <p className="text-sm text-muted">
              <span className="font-mono tabular-nums">{i + 1}</span>. {q.prompt}
            </p>
            <p className="mt-1 text-lg font-medium text-ink">{optionLabel(config, q, answers[q.id])}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function TickStrip({ config, ticks }: { config: EventConfig; ticks: Record<string, boolean> }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label="Correct answers">
      {config.questions.map((q, i) => (
        <li
          key={q.id}
          className={`flex size-11 items-center justify-center rounded-lg border font-mono text-sm ${
            ticks[q.id] ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'
          }`}
        >
          <span className="sr-only">
            Question {i + 1}: {ticks[q.id] ? 'correct' : 'missed'}
          </span>
          {ticks[q.id] ? (
            <Check size={20} weight="regular" aria-hidden="true" />
          ) : (
            <X size={20} weight="regular" aria-hidden="true" />
          )}
        </li>
      ))}
    </ul>
  );
}
