import { useEffect, useState } from 'react';
import { FloppyDisk } from '@phosphor-icons/react';
import Button from '../components/Button';
import { QUESTIONS, optionsFor } from '../config/event';
import { saveResults } from '../lib/db';
import type { Results, ResultsDoc } from '../lib/types';

export default function ResultsForm({
  resultsDoc,
  results,
}: {
  resultsDoc: ResultsDoc | null;
  results: Results;
}) {
  const [draft, setDraft] = useState<Results>(results);
  const [source, setSource] = useState(resultsDoc?.source ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const savedKey = JSON.stringify(results) + (resultsDoc?.source ?? '');
  useEffect(() => {
    setDraft(results);
    setSource(resultsDoc?.source ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  function toggle(q: string, id: string) {
    setDraft((d) => ({
      ...d,
      [q]: d[q].includes(id) ? d[q].filter((x) => x !== id) : [...d[q], id],
    }));
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

  return (
    <section aria-label="Results" className="border-b border-line py-8">
      <h2 className="text-3xl font-semibold">Race results</h2>
      <p className="mt-1 text-muted">
        Tick every accepted answer. Leave a question empty to void it, nobody scores on it.
      </p>
      <div className="mt-6 divide-y divide-line">
        {QUESTIONS.map((q, i) => {
          const saved = results[q.id];
          const opts = optionsFor(q);
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
                  const on = draft[q.id].includes(o.id);
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
              {draft[q.id].length > 0 && (
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
