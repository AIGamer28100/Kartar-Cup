import { CheckCircle, Flag, LockSimple, type Icon } from '@phosphor-icons/react';
import { maxScore } from '../../lib/scoring';
import type { EventConfig } from '../../lib/types';
import { SCORING_NOTE, closesCell } from './logic';

const LABEL = 'font-mono text-[0.65rem] uppercase tracking-widest text-muted';

/** Calls / Points / Closes strip. */
export function GameFacts({ config }: { config: EventConfig }) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line bg-raised">
      <div className="min-w-0 px-3 py-3">
        <dt className={LABEL}>Calls</dt>
        <dd className="mt-1 font-mono text-2xl font-medium tabular-nums text-ink">{config.questions.length}</dd>
      </div>
      <div className="min-w-0 px-3 py-3">
        <dt className={LABEL}>Points</dt>
        <dd className="mt-0.5 font-num text-3xl font-extrabold italic leading-none tabular-nums text-gold">{maxScore(config.questions)}</dd>
      </div>
      <div className="min-w-0 px-3 py-3">
        <dt className={LABEL}>Closes</dt>
        <dd className="mt-1.5 text-sm font-semibold leading-tight text-ink">{closesCell(config)}</dd>
      </div>
    </dl>
  );
}

const STEPS = ['Make a call on each question: a driver, a team or yes / no.', 'Lock in your grid. Once you lock in, your picks cannot be changed.', SCORING_NOTE];

/** The three-step "How it plays" list. */
export function HowItPlays() {
  return (
    <ol className="m-0 grid list-none gap-3 p-0">
      {STEPS.map((t, i) => (
        <li key={t} className="flex items-start gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-mono text-xs tabular-nums text-ink">{i + 1}</span>
          <span className="pt-0.5 text-sm text-muted">{t}</span>
        </li>
      ))}
    </ol>
  );
}

/** Locked in -> pit lane closes -> scored: how far through the round the guest is. */
export function RoundTimeline({ stage, closesLabel }: { stage: 'locked' | 'closed' | 'scored'; closesLabel: string }) {
  const at = ['locked', 'closed', 'scored'].indexOf(stage);
  const steps: { icon: Icon; label: string; sub: string }[] = [
    { icon: LockSimple, label: 'Picks locked in', sub: 'Your picks cannot be changed' },
    { icon: Flag, label: 'Pit lane closes', sub: closesLabel },
    { icon: CheckCircle, label: 'Scored after the race', sub: 'From the official classification' },
  ];
  return (
    <ol className="m-0 grid list-none gap-0 p-0" aria-label="Round progress">
      {steps.map((s, i) => {
        const done = i <= at;
        const Ic = s.icon;
        return (
          <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden="true" className={`absolute left-[0.9375rem] top-8 bottom-0 w-px ${i < at ? 'bg-accent' : 'bg-line'}`} />}
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${done ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-raised text-muted'}`}>
              <Ic size={16} weight={done ? 'bold' : 'regular'} aria-hidden="true" />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className={`block text-sm font-semibold ${done ? 'text-ink' : 'text-muted'}`}>
                {s.label}
                <span className="sr-only">{done ? ' (done)' : ' (to come)'}</span>
              </span>
              <span className="block text-xs text-muted">{s.sub}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
