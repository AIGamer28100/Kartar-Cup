import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { boldCalls, crowdBreakdown, roomAccuracy } from '../lib/crowd';
import type { QuestionCrowd } from '../lib/crowd';
import { normalize } from '../lib/scoring';
import { YESNO_OPTIONS } from '../lib/types';
import type { Entry, EventConfig, QuestionCfg, Results, ScorableEntry } from '../lib/types';

const pct = (share: number) => `${Math.round(share * 100)}%`;

interface Opt {
  label: string;
  code: string;
}

/** Three-letter code: driver surname / team name start, e.g. "Max Verstappen" -> VER. */
function codeOf(label: string): string {
  const words = label.trim().split(/\s+/);
  const key = words.length > 1 ? words[words.length - 1] : words[0];
  return key.slice(0, 3).toUpperCase();
}

function optionMap(config: EventConfig, q: QuestionCfg | undefined): Map<string, Opt> {
  const src = q?.kind === 'yesno' ? YESNO_OPTIONS : q?.kind === 'team' ? config.teams : config.drivers;
  return new Map(src.map((o) => [normalize(o.id), { label: o.label, code: codeOf(o.label) }]));
}

function Bar({ share, actual, delay, reduce }: { share: number; actual: boolean; delay: number; reduce: boolean }) {
  return (
    <div className="relative h-4 w-full border-l border-ink/40">
      <motion.div
        initial={reduce ? false : { scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 0.25, delay, ease: 'easeOut' }}
        style={{ width: `${Math.max(share * 100, share > 0 ? 1.5 : 0)}%`, transformOrigin: 'left' }}
        className={`h-full ${actual ? 'border-2 border-accent bg-accent/25' : 'bg-muted/60'}`}
      />
    </div>
  );
}

function QuestionRow({
  b,
  q,
  config,
  index,
  reduce,
}: {
  b: QuestionCrowd;
  q: QuestionCfg | undefined;
  config: EventConfig;
  index: number;
  reduce: boolean;
}) {
  const opts = optionMap(config, q);
  const acceptedNorm = b.accepted.map(normalize);
  const shown = b.picks.slice(0, 3);
  const missing = acceptedNorm
    .filter((id) => !shown.some((p) => p.optionId === id))
    .map((id) => ({ optionId: id, count: 0, share: 0 }));
  const rows = [...shown, ...missing];
  return (
    <li className="py-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-[1.125rem] font-semibold">{q?.prompt ?? b.questionId}</h3>
        <p className="font-mono text-sm tabular-nums text-muted">
          {b.voided ? 'Voided' : `${b.roomRight} of ${b.total} right (${pct(b.roomRightShare)})`}
        </p>
      </div>
      {b.total === 0 ? (
        <p className="mt-2 text-muted">No picks on this one.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((p, i) => {
            const o = opts.get(p.optionId);
            const actual = acceptedNorm.includes(p.optionId);
            return (
              <li
                key={p.optionId}
                className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_5.5rem] items-center gap-x-3 md:grid-cols-[14rem_minmax(0,1fr)_7rem]"
              >
                <span className="min-w-0 truncate">
                  <span className="font-mono text-sm tabular-nums text-muted">{o?.code ?? '---'}</span>{' '}
                  <span className="text-[1rem]">{o?.label ?? p.optionId}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Bar share={p.share} actual={actual} delay={reduce ? 0 : index * 0.05 + i * 0.04} reduce={reduce} />
                  {actual && (
                    <span className="shrink-0 rounded-sm border border-accent px-1.5 py-0.5 text-xs uppercase tracking-widest text-accent">
                      Actual
                    </span>
                  )}
                </span>
                <span className="text-right font-mono text-sm tabular-nums">
                  {p.count} / {pct(p.share)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

export default function CrowdReveal({
  config,
  entries,
  results,
}: {
  config: EventConfig | null;
  entries: Entry[];
  results: Results;
}) {
  const reduce = !!useReducedMotion();
  const ids = config?.questionIds;
  const hasResults = Object.values(results).some((r) => r.length > 0);

  const model = useMemo(() => {
    if (!ids) return null;
    const scorable: ScorableEntry[] = entries.map((e) => ({
      uid: e.uid,
      name: e.name,
      answers: e.answers,
      submittedAtMs: e.submittedAt.toMillis(),
    }));
    const breakdown = crowdBreakdown(scorable, results, ids);
    return { breakdown, acc: roomAccuracy(breakdown), bold: boldCalls(scorable, results, ids) };
  }, [entries, results, ids]);

  if (!config || !model || !hasResults || entries.length === 0) return null;
  const { breakdown, acc, bold } = model;
  const qOf = (id: string) => config.questions.find((q) => q.id === id);
  const labelOf = (questionId: string, optionId: string) =>
    optionMap(config, qOf(questionId)).get(normalize(optionId))?.label ?? optionId;

  return (
    <section aria-label="Crowd vs reality" className="py-8">
      <h2 className="text-2xl font-semibold">Crowd vs reality</h2>

      <div className="mt-4">
        <p className="flex items-baseline gap-3">
          <span className="text-lg text-muted">Room accuracy</span>
          <span className="font-mono text-5xl font-semibold tabular-nums md:text-7xl">{acc.percent}%</span>
        </p>
        <div
          role="meter"
          aria-label="Room accuracy"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={acc.percent}
          aria-valuetext={`${acc.percent} percent`}
          className="relative mt-3 h-6 border border-line"
        >
          <motion.div
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            style={{ width: `${acc.percent}%`, transformOrigin: 'left' }}
            className="h-full bg-accent"
          />
          {[25, 50, 75].map((t) => (
            <span
              key={t}
              aria-hidden
              className="absolute inset-y-0 w-px bg-ink/50"
              style={{ left: `${t}%` }}
            />
          ))}
        </div>
        <div aria-hidden className="relative mt-1 h-4 font-mono text-xs tabular-nums text-muted">
          {[0, 25, 50, 75, 100].map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full"
              style={{ left: `${t}%` }}
            >
              {t}
            </span>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">
          Average share of the room that got each question right, across {acc.scored} scored
          question{acc.scored === 1 ? '' : 's'}. Voided questions are left out.
        </p>
      </div>

      <ul className="mt-4 divide-y divide-line">
        {breakdown.map((b, i) => (
          <QuestionRow key={b.questionId} b={b} q={qOf(b.questionId)} config={config} index={i} reduce={reduce} />
        ))}
      </ul>

      <h3 className="mt-6 text-xl font-semibold">Bold calls</h3>
      {bold.length === 0 ? (
        <p className="mt-2 text-muted">No bold calls this race. Needs 5 or more picks and a right answer under 20% of the room.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {bold.map((c) => (
            <li key={`${c.uid}-${c.questionId}`} className="flex flex-wrap items-baseline justify-between gap-x-4 py-3">
              <span className="text-[1rem]">
                <span className="font-semibold">{c.name}</span> called {labelOf(c.questionId, c.optionId)}
                <span className="text-muted"> on {qOf(c.questionId)?.prompt ?? c.questionId}</span>
              </span>
              <span className="font-mono text-sm tabular-nums text-accent">only {pct(c.share)} of the room</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
