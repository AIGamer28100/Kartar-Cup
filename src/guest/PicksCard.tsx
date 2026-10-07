import { pointsOf } from '../lib/scoring';
import type { EventConfig } from '../lib/types';
import type { PickMap } from './draft';
import { optionLabel } from './model';
import { H3 } from './parts';

/** The guest's OWN answers with their option labels. Own data only (R15): never other guests' counts. */
export default function PicksCard({ config, answers }: { config: EventConfig; answers: PickMap }) {
  const locked = config.questions.filter((q) => !!answers[q.id]).length;
  return (
    <section aria-label="Your locked picks" className="rounded-xl border border-line bg-raised p-5">
      <h2 className={H3}>
        <span className="font-mono tabular-nums">{locked}</span> {locked === 1 ? 'pick' : 'picks'} locked in
      </h2>
      <ol className="m-0 mt-3 list-none divide-y divide-line p-0">
        {config.questions.map((q, i) => {
          const pts = pointsOf(q);
          return (
            <li key={q.id} className="py-3">
              <p className="flex items-baseline justify-between gap-3 text-sm text-muted">
                <span className="min-w-0">
                  <span className="font-mono tabular-nums">{i + 1}</span>. {q.prompt}
                </span>
                {pts > 1 && <span className="shrink-0 font-mono tabular-nums">{pts} pts</span>}
              </p>
              <p className="mt-1 text-lg font-medium text-ink">{optionLabel(config, q, answers[q.id])}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
