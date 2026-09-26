import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, MagnifyingGlass } from '@phosphor-icons/react';
import Button from '../components/Button';
import { QUESTIONS, optionsFor } from '../config/event';
import type { Answers } from '../lib/types';
import { Eyebrow, PicksList, SPRING, Shell } from './parts';

interface Props {
  answers: Partial<Answers>;
  step: number;
  submitting: boolean;
  error: string;
  isEdit: boolean;
  onAnswer: (qid: keyof Answers, id: string) => void;
  onStep: (n: number) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}

export default function Quiz({
  answers,
  step,
  submitting,
  error,
  isEdit,
  onAnswer,
  onStep,
  onSubmit,
  onCancel,
}: Props) {
  const reduce = useReducedMotion();
  const total = QUESTIONS.length;
  const review = step >= total;
  const q = QUESTIONS[Math.min(step, total - 1)];

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <Eyebrow>{review ? 'Final check' : 'Question'}</Eyebrow>
        <p className="font-mono text-sm tabular-nums text-muted" aria-live="polite">
          {Math.min(step + 1, total)} / {total}
        </p>
      </div>
      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={Math.min(step + 1, total)}
        aria-label="Quiz progress"
      >
        {QUESTIONS.map((x, i) => (
          <span
            key={x.id}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              i <= step ? 'bg-accent' : 'bg-line'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          className="mt-8 flex flex-1 flex-col"
          initial={reduce ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -24 }}
          transition={SPRING}
        >
          {review ? (
            <>
              <h1 className="text-3xl font-semibold leading-tight tracking-tight">Ready to commit?</h1>
              <p className="mt-2 text-muted">Use back to change a pick. Picks lock at lights-out.</p>
              <div className="mt-4">
                <PicksList answers={answers} />
              </div>
              {error && (
                <p role="alert" className="mt-4 text-sm text-accent">
                  {error}
                </p>
              )}
              <div className="mt-6 flex gap-3">
                <Button variant="secondary" aria-label="Back" onClick={() => onStep(total - 1)}>
                  <ArrowLeft size={20} weight="regular" aria-hidden="true" />
                </Button>
                <Button className="flex-1" disabled={submitting} onClick={onSubmit}>
                  {submitting ? 'Transmitting...' : isEdit ? 'Update my picks' : 'Lock in my picks'}
                </Button>
              </div>
            </>
          ) : (
            <Step
              key={q.id}
              qi={step}
              value={answers[q.id]}
              onPick={(id) => onAnswer(q.id, id)}
              onBack={step > 0 ? () => onStep(step - 1) : onCancel}
              onNext={() => onStep(step + 1)}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

function Step({
  qi,
  value,
  onPick,
  onBack,
  onNext,
}: {
  qi: number;
  value: string | undefined;
  onPick: (id: string) => void;
  onBack?: () => void;
  onNext: () => void;
}) {
  const q = QUESTIONS[qi];
  const opts = useMemo(() => optionsFor(q), [q]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const uid = useId();
  const listId = `${uid}-list`;

  const shown = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t
      ? opts.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(t))
      : opts;
  }, [opts, query]);
  const cur = Math.min(active, Math.max(0, shown.length - 1));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(cur + 1, shown.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(cur - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = shown[cur];
      if (o) {
        if (o.id === value) onNext();
        else onPick(o.id);
      }
    }
  };

  return (
    <>
      <h1 className="text-3xl font-semibold leading-tight tracking-tight">{q.prompt}</h1>
      {q.hint && <p className="mt-2 text-muted">{q.hint}</p>}

      <label htmlFor={`${uid}-search`} className="mb-2 mt-6 block text-sm font-medium">
        Search {q.kind === 'team' ? 'constructors' : 'drivers'}
      </label>
      <div className="relative">
        <MagnifyingGlass
          size={20}
          weight="regular"
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          id={`${uid}-search`}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={shown[cur] ? `${uid}-o-${shown[cur].id}` : undefined}
          autoComplete="off"
          className="min-h-12 w-full rounded-lg border border-line bg-raised pl-11 pr-4 text-[1rem] text-ink placeholder:text-muted focus:border-accent"
          placeholder={q.kind === 'team' ? 'Type a team' : 'Type a driver or team'}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
        />
      </div>

      <ul
        id={listId}
        role="listbox"
        aria-label={q.prompt}
        className="m-0 mt-2 max-h-[42dvh] list-none overflow-y-auto p-0"
      >
        {shown.map((o, i) => {
          const sel = o.id === value;
          return (
            <li
              key={o.id}
              id={`${uid}-o-${o.id}`}
              role="option"
              aria-selected={sel}
              onClick={() => onPick(o.id)}
              className={`flex min-h-12 cursor-pointer items-center justify-between gap-3 border-b border-line px-2 py-2 transition-colors duration-150 active:bg-raised ${
                i === cur ? 'bg-raised' : ''
              }`}
            >
              <span>
                <span className={`block text-[1rem] ${sel ? 'font-semibold text-ink' : 'text-ink'}`}>
                  {o.label}
                </span>
                {o.sub && <span className="block font-mono text-xs text-muted">{o.sub}</span>}
              </span>
              {sel && <Check size={20} weight="regular" className="shrink-0 text-accent" aria-label="Selected" />}
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="py-6 text-muted">Nothing on the grid matches that. Check the spelling.</li>
        )}
      </ul>

      <div className="mt-auto flex gap-3 pt-6">
        {onBack && (
          <Button variant="secondary" aria-label="Back" onClick={onBack}>
            <ArrowLeft size={20} weight="regular" aria-hidden="true" />
          </Button>
        )}
        <Button className="flex-1" disabled={!value} onClick={onNext}>
          {qi === QUESTIONS.length - 1 ? 'Review picks' : 'Next question'}
          <ArrowRight size={20} weight="regular" aria-hidden="true" />
        </Button>
      </div>
    </>
  );
}
