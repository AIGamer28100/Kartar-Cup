import { useEffect, useMemo, useState } from 'react';
import { CloudArrowDown, FloppyDisk } from '@phosphor-icons/react';
import Button from '../components/Button';
import { getRace } from '../config/calendar';
import { saveResults } from '../lib/db';
import { fetchRaceFactsForRace, mapFactsToQuestions } from '../lib/raceResults';
import type { EventConfig, QuestionCfg, Results, ResultsDoc } from '../lib/types';

interface Opt {
  id: string;
  label: string;
}

/** Answer choices come from the live event's own lineup (not a static template), so the ids the
 * host ticks are exactly the ids guests picked from. */
function optionsFor(config: EventConfig, q: QuestionCfg): Opt[] {
  if (q.kind === 'team') return config.teams.map((t) => ({ id: t.id, label: t.label }));
  return [...config.drivers].sort((a, b) => a.grid - b.grid).map((d) => ({ id: d.id, label: d.label }));
}

export default function ResultsForm({
  config,
  resultsDoc,
  results,
}: {
  config: EventConfig | null;
  resultsDoc: ResultsDoc | null;
  results: Results;
}) {
  const [draft, setDraft] = useState<Results>(results);
  const [source, setSource] = useState(resultsDoc?.source ?? '');
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  const savedKey = JSON.stringify(results) + (resultsDoc?.source ?? '');
  useEffect(() => {
    setDraft(results);
    setSource(resultsDoc?.source ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const race = useMemo(() => (config ? getRace(config.raceId) : undefined), [config]);

  function toggle(q: string, id: string) {
    setDraft((d) => {
      const cur = d[q] ?? [];
      return { ...d, [q]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await saveResults(draft, source.trim());
      setMsg({ ok: true, text: 'Results saved. Stewards have nothing to add.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function pull() {
    if (!config || !race) return;
    setPulling(true);
    setMsg(null);
    setNotes([]);
    try {
      const res = await fetchRaceFactsForRace(race.season, race);
      if (!res.ok) {
        setMsg({ ok: false, text: res.reason });
        return;
      }
      const mapped = mapFactsToQuestions(res.facts, config.questions, {
        team: new Set(config.teams.map((t) => t.id)),
        driver: new Set(config.drivers.map((d) => d.id)),
      });
      setDraft((d) => ({ ...d, ...mapped.answers }));
      setSource(`OpenF1 race session ${res.sessionKey}, pulled ${new Date().toLocaleString('en-GB')}`);
      setNotes([...res.facts.notes, ...mapped.skipped]);
      setMsg({
        ok: true,
        text: `Filled ${mapped.filled.length} of ${config.questions.length} questions from OpenF1. Check them, then save.`,
      });
    } finally {
      setPulling(false);
    }
  }

  if (!config) {
    return (
      <section aria-label="Results" className="border-b border-line py-8">
        <h2 className="text-2xl font-semibold">Race results</h2>
        <p className="mt-1 text-muted">No event is live. Set one live in Settings to enter results.</p>
      </section>
    );
  }

  return (
    <section aria-label="Results" className="border-b border-line py-8">
      <h2 className="text-2xl font-semibold">Race results</h2>
      <p className="mt-1 text-muted">
        Tick every accepted answer. Leave a question empty to void it, nobody scores on it.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={!race || pulling} onClick={() => void pull()}>
          <CloudArrowDown size={20} weight="regular" className={pulling ? 'animate-pulse' : undefined} />
          {pulling ? 'Pulling...' : 'Pull from OpenF1'}
        </Button>
        <p className="text-sm text-muted">
          {race
            ? 'Fills the draft from the finished race. Nothing is saved until you press Save.'
            : 'Custom events have no calendar race to pull from.'}
        </p>
      </div>
      {notes.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <div className="mt-6 divide-y divide-line">
        {config.questions.map((q, i) => {
          const saved = results[q.id] ?? [];
          const opts = optionsFor(config, q);
          const picked = draft[q.id] ?? [];
          return (
            <fieldset key={q.id} className="py-5">
              <legend className="mb-3 text-xl">
                <span className="mr-3 font-mono text-muted">{i + 1}</span>
                {q.prompt}
              </legend>
              <p className="mb-3 text-sm text-muted">
                Saved:{' '}
                <span className="font-mono text-ink">
                  {saved.length
                    ? saved.map((id) => opts.find((o) => o.id === id)?.label ?? id).join(', ')
                    : 'voided or not set'}
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {opts.map((o) => {
                  const on = picked.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(q.id, o.id)}
                      className={`min-h-11 rounded-lg border px-4 text-[1rem] transition duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        on
                          ? 'border-accent bg-accent text-accent-ink'
                          : 'border-line bg-raised text-ink hover:border-muted'
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
              {picked.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, [q.id]: [] }))}
                  className="mt-3 min-h-11 text-sm text-muted underline hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                >
                  Void this question
                </button>
              )}
            </fieldset>
          );
        })}
      </div>
      <label className="mt-2 flex flex-col gap-1 text-sm text-muted">
        Source note
        <input
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="e.g. official timing sheet, lap 41 review"
          className="min-h-12 rounded-lg border border-line bg-raised px-3 text-[1rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </label>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <Button disabled={busy} onClick={save}>
          <FloppyDisk size={20} weight="regular" /> Save results
        </Button>
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-muted' : 'text-accent'}>
            {msg.text}
          </p>
        )}
      </div>
    </section>
  );
}
