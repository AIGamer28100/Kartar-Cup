import { useMemo } from 'react';
import { Check, PencilSimple, X } from '@phosphor-icons/react';
import { parseCardAnswer } from '../lib/cardAnswer';
import { pointsOf } from '../lib/scoring';
import type { EventConfig } from '../lib/types';
import type { PickMap } from './draft';
import { cardsFor, type AnswerCard } from './quiz/grid';
import { isAnswered } from './quiz/logic';
import { useFaces } from './quiz/faces';
import PointsBadge from './quiz/PointsBadge';
import Tile from './quiz/Tile';

/**
 * "Your grid": the guest's OWN picks, one compact card per question with the pick's face or team colour
 * (R15: own data only, never other guests' picks or counts). Optional per-row Edit (review screen) and,
 * once the race is scored, the guest's own ticks.
 */
export default function PicksCard({
  config,
  answers,
  title,
  onEdit,
  ticks,
}: {
  config: EventConfig;
  answers: PickMap;
  title?: string;
  onEdit?: (index: number) => void;
  ticks?: Record<string, boolean>;
}) {
  const faces = useFaces();
  const byQ = useMemo(() => {
    const m = new Map<string, AnswerCard | undefined>();
    for (const q of config.questions) {
      const id = q.kind === 'card' ? parseCardAnswer(answers[q.id])?.driverId : answers[q.id];
      m.set(q.id, id ? cardsFor(config, q, faces).find((c) => c.id === id) : undefined);
    }
    return m;
  }, [config, answers, faces]);
  const made = config.questions.filter((q) => isAnswered(q, answers)).length;
  const total = config.questions.length;
  return (
    <section aria-label={title ?? 'Your locked picks'} className="min-w-0">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-h3 font-semibold text-balance">{title ?? 'Your grid'}</h2>
        <p className="shrink-0 font-mono text-xs uppercase tracking-widest text-muted">
          <span className="tabular-nums text-ink">{made}</span> / <span className="tabular-nums">{total}</span> called
        </p>
      </div>
      <ol className="m-0 grid list-none gap-2 p-0">
        {config.questions.map((q, i) => {
          const card = byQ.get(q.id);
          const id = q.kind === 'card' ? parseCardAnswer(answers[q.id])?.driverId : answers[q.id];
          const cardPts = q.kind === 'card' ? parseCardAnswer(answers[q.id])?.points : undefined;
          const tick = ticks ? !!ticks[q.id] : null;
          return (
            <li
              key={q.id}
              className="flex min-h-[4.5rem] min-w-0 items-stretch overflow-hidden rounded-xl border border-line bg-raised"
              style={card && card.kind !== 'yesno' ? { background: `linear-gradient(110deg, color-mix(in srgb, ${card.colour} 18%, var(--color-raised)), var(--color-raised) 70%)` } : undefined}
            >
              {card ? (
                <Tile card={card} cols={2} className="w-12 sm:w-14" />
              ) : (
                <span aria-hidden="true" className="flex w-12 shrink-0 items-center justify-center bg-surface font-mono text-xs text-muted sm:w-14">
                  {id ? id.slice(0, 3).toUpperCase() : '?'}
                </span>
              )}
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
                <p className="flex min-w-0 items-baseline gap-2 text-xs text-muted">
                  <span className="shrink-0 font-mono tabular-nums">Q{i + 1}</span>
                  <span className="line-clamp-2 min-w-0">{q.prompt}</span>
                </p>
                <p className={`truncate font-semibold ${id ? 'text-ink' : 'text-accent-text'}`}>
                  {card ? card.label : id ? id : 'No pick yet'}
                  {cardPts !== undefined && <span className="font-normal text-muted"> · {cardPts} pts</span>}
                  {card?.kind === 'driver' && card.sub && <span className="font-normal text-muted"> / {card.sub}</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 pr-2">
                <PointsBadge pts={pointsOf(q)} small />
                {tick !== null && (
                  <span
                    className={`flex size-9 items-center justify-center rounded-lg border ${tick ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}`}
                  >
                    {tick ? <Check size={18} weight="bold" aria-hidden="true" /> : <X size={18} weight="regular" aria-hidden="true" />}
                    <span className="sr-only">{tick ? 'Correct' : 'Missed'}</span>
                  </span>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(i)}
                    aria-label={`${id ? 'Change' : 'Make'} pick for call ${i + 1}`}
                    className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <PencilSimple size={16} weight="regular" aria-hidden="true" />
                    <span className="hidden sm:inline">{id ? 'Edit' : 'Pick'}</span>
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
