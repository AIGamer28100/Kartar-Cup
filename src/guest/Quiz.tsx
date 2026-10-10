import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, LockSimple, MagnifyingGlass, X } from '@phosphor-icons/react';
import Button from '../components/Button';
import { DUR, EASE, SPRING } from '../lib/motion';
import { maxScore, pointsOf } from '../lib/scoring';
import type { EventConfig, QuestionCfg } from '../lib/types';
import type { PickMap } from './draft';
import PicksCard from './PicksCard';
import AnswerGrid from './quiz/AnswerGrid';
import { useFaces } from './quiz/faces';
import { cardsFor } from './quiz/grid';
import {
  ADVANCE_MS,
  SCORING_NOTE,
  SEARCH_MIN_OPTIONS,
  closesCopy,
  countAnswered,
  delayedHold,
  filterCards,
  nextAfterPick,
} from './quiz/logic';
import PlayShell from './quiz/PlayShell';
import PointsBadge from './quiz/PointsBadge';
import { ClosePill } from './quiz/RaceClock';
import { LightsRail } from './quiz/StartLights';

interface Props {
  config: EventConfig;
  answers: PickMap;
  step: number;
  submitting: boolean;
  error: string;
  onAnswer: (qid: string, id: string) => void;
  onStep: (n: number) => void;
  onSubmit: () => void;
}

const KIND_LABEL: Record<QuestionCfg['kind'], string> = {
  driver: 'Pick a driver',
  team: 'Pick a team',
  yesno: 'Yes or no',
};

/** Sticky action bar on phones (thumb reach), inline beside the grid on wide screens. */
const barCls =
  'sticky bottom-0 z-10 -mx-4 mt-6 flex gap-3 border-t border-line bg-base/90 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 md:-mx-10 md:px-10 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none';

/**
 * The quiz as a game: one call per screen, start-light progress rail, answer cards that auto-advance after
 * a short beat (Back always cancels it), then "Your grid" review with one big lock-in button.
 */
export default function Quiz({ config, answers, step, submitting, error, onAnswer, onStep, onSubmit }: Props) {
  const reduce = useReducedMotion();
  const live = config;
  const QUESTIONS = config.questions;
  const total = QUESTIONS.length;
  const review = step >= total;
  const [fromReview, setFromReview] = useState(false);
  const [dir, setDir] = useState(1);
  // The pending auto-advance, tagged with the step it was started on so a stale one never shows.
  const timer = useRef<number | undefined>(undefined);
  const [advanceFrom, setAdvanceFrom] = useState<number | null>(null);
  const advancing = advanceFrom === step;

  const cancel = () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setAdvanceFrom(null);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => () => window.clearTimeout(timer.current), [step]);

  const go = (n: number) => {
    cancel();
    setDir(n >= step ? 1 : -1);
    if (n >= total) setFromReview(false);
    onStep(n);
  };
  const jump = (n: number) => {
    if (review) setFromReview(true);
    go(n);
  };

  const pick = (q: QuestionCfg, id: string) => {
    onAnswer(q.id, id);
    window.clearTimeout(timer.current);
    setAdvanceFrom(step);
    const target = nextAfterPick(step, total, fromReview);
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setAdvanceFrom(null);
      setDir(1);
      if (target >= total) setFromReview(false);
      onStep(target);
    }, ADVANCE_MS);
  };

  const made = countAnswered(QUESTIONS, answers);
  const q = QUESTIONS[Math.min(step, total - 1)];

  return (
    <PlayShell hud={<ClosePill config={live} />}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <LightsRail questions={QUESTIONS} answers={answers} current={step} onJump={jump} />
        <p className="font-mono text-xs uppercase tracking-widest text-muted" aria-live="polite">
          {review ? (
            <>
              Your grid <span className="tabular-nums text-ink">{made}</span>/<span className="tabular-nums">{total}</span>
            </>
          ) : (
            <>
              Call <span className="tabular-nums text-ink">{step + 1}</span> of <span className="tabular-nums">{total}</span>
            </>
          )}
        </p>
      </div>
      {delayedHold(live) && (
        <p role="status" className="mt-3 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-ink">
          {closesCopy(live)}
        </p>
      )}

      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={review ? 'review' : q.id}
          className="mt-6 flex flex-1 flex-col md:mt-8"
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: 40 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 * dir }}
          transition={reduce ? { duration: DUR.fast } : { duration: DUR.base, ease: EASE.out }}
        >
          {review ? (
            <Review
              config={config}
              answers={answers}
              made={made}
              submitting={submitting}
              error={error}
              onEdit={jump}
              onBack={() => go(total - 1)}
              onSubmit={onSubmit}
            />
          ) : (
            <Question
              config={config}
              q={q}
              value={answers[q.id]}
              advancing={advancing}
              onPick={(id) => pick(q, id)}
              onBack={step > 0 ? () => go(step - 1) : undefined}
              onNext={() => go(fromReview ? total : step + 1)}
              last={step === total - 1 || fromReview}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </PlayShell>
  );
}

function Question({
  config,
  q,
  value,
  advancing,
  onPick,
  onBack,
  onNext,
  last,
}: {
  config: EventConfig;
  q: QuestionCfg;
  value: string | undefined;
  advancing: boolean;
  onPick: (id: string) => void;
  onBack?: () => void;
  onNext: () => void;
  last: boolean;
}) {
  const reduce = useReducedMotion();
  const faces = useFaces();
  const cards = useMemo(() => cardsFor(config, q, faces), [config, q, faces]);
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterCards(cards, query), [cards, query]);
  const uid = useId();
  const headId = `${uid}-q`;
  const searchable = cards.length >= SEARCH_MIN_OPTIONS;
  const picked = cards.find((c) => c.id === value);

  return (
    <div className="grid flex-1 content-start gap-x-14 gap-y-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">
        <div className="flex flex-wrap items-center gap-3">
          <PointsBadge pts={pointsOf(q)} />
          <span className="font-mono text-xs uppercase tracking-widest text-muted">{KIND_LABEL[q.kind]}</span>
        </div>
        <motion.h1
          id={headId}
          className="mt-4 max-w-[22ch] text-h2 font-semibold text-balance"
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING.soft, delay: 0.05 }}
        >
          {q.prompt}
        </motion.h1>
        {q.hint && <p className="mt-3 max-w-[40ch] text-pretty text-muted">{q.hint}</p>}
        <p className="mt-4 hidden min-h-6 text-sm text-muted lg:block">
          {picked ? (
            <>
              Your call: <span className="font-semibold text-ink">{picked.label}</span>
            </>
          ) : (
            'Tap a card to make your call.'
          )}
        </p>
      </div>

      <div className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
        {searchable && (
          <div className="relative mb-3 sm:max-w-sm">
            <label htmlFor={`${uid}-s`} className="sr-only">
              Find a {q.kind === 'team' ? 'team' : 'driver or team'}
            </label>
            <MagnifyingGlass size={18} weight="regular" aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id={`${uid}-s`}
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              className="min-h-11 w-full rounded-full border border-line bg-raised pl-10 pr-11 text-[1rem] text-ink placeholder:text-muted focus:border-accent"
              placeholder={q.kind === 'team' ? 'Find a team' : 'Find a driver or team'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery('')}
                className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-full text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X size={16} weight="regular" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {shown.length > 0 ? (
          <AnswerGrid cards={shown} value={value} onPick={onPick} labelledBy={headId} />
        ) : (
          <div role="status" className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-muted">
            Nobody on the grid matches that.{' '}
            <button type="button" onClick={() => setQuery('')} className="min-h-11 font-medium text-ink underline focus-visible:outline-2 focus-visible:outline-accent">
              Show everyone
            </button>
          </div>
        )}
        <p className="mt-3 hidden font-mono text-[0.7rem] uppercase tracking-widest text-muted pointer-fine:block">
          Arrow keys to move, Enter to pick, 1-9 to quick-pick
        </p>
        <span className="sr-only" aria-live="polite">
          {picked ? `Picked ${picked.label}` : ''}
        </span>
      </div>
        <div className={`${barCls} lg:col-start-1 lg:row-start-2 lg:mt-0 lg:max-w-sm lg:self-start`}>
          {onBack && (
            <Button variant="secondary" onClick={onBack} className="min-w-12 px-4">
              <ArrowLeft size={20} weight="regular" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Back</span>
            </Button>
          )}
          <Button className="relative flex-1 overflow-hidden" disabled={!value} onClick={onNext}>
            {last ? 'Review my grid' : 'Next call'}
            <ArrowRight size={20} weight="regular" aria-hidden="true" />
            {advancing && !reduce && (
              <motion.span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-1 origin-left bg-accent-ink/70"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: ADVANCE_MS / 1000, ease: 'linear' }}
              />
            )}
          </Button>
        </div>
    </div>
  );
}

function Review({
  config,
  answers,
  made,
  submitting,
  error,
  onEdit,
  onBack,
  onSubmit,
}: {
  config: EventConfig;
  answers: PickMap;
  made: number;
  submitting: boolean;
  error: string;
  onEdit: (i: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const total = config.questions.length;
  const complete = made === total;
  const live = config;
  return (
    <div className="grid flex-1 content-start gap-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-14">
      <div className="min-w-0">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">Final check</p>
        <h1 className="mt-3 text-h2 font-semibold text-balance">Your grid</h1>
        <p className="mt-3 max-w-[40ch] text-pretty text-muted">
          {complete ? `All ${total} calls made.` : `${made} of ${total} calls made. Fill the gaps to lock in.`} Up to{' '}
          <span className="font-num text-lg font-extrabold italic tabular-nums text-gold">{maxScore(config.questions)}</span> points on the line.
        </p>
        <p className="mt-3 max-w-[40ch] text-pretty text-sm text-muted">{SCORING_NOTE}</p>
        <p className="mt-2 max-w-[40ch] text-pretty text-sm text-muted">{closesCopy(live)}</p>
      </div>
      <div className="min-w-0">
        <PicksCard config={config} answers={answers} title="Your calls" onEdit={onEdit} />
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-accent/60 bg-accent/10 px-3 py-2 text-sm text-accent-text">
            {error}
          </p>
        )}
        <div className={barCls}>
          <Button variant="secondary" onClick={onBack} className="min-h-16 min-w-14 px-4" aria-label="Back to the last call">
            <ArrowLeft size={20} weight="regular" aria-hidden="true" />
          </Button>
          <button
            type="button"
            disabled={!complete || submitting}
            aria-disabled={!complete || submitting}
            onClick={onSubmit}
            className="press relative flex min-h-16 flex-1 items-center justify-center gap-3 overflow-hidden rounded-xl bg-accent px-5 text-lg font-semibold text-accent-ink shadow-[0_8px_30px_-8px_rgb(216_30_54/0.7)] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <span className="start-lights" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                Transmitting
              </>
            ) : (
              <>
                <LockSimple size={22} weight="bold" aria-hidden="true" />
                {!complete ? `Make all ${total} calls` : 'Lock in my picks'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
