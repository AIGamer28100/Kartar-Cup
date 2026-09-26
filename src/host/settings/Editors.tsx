import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { MAX_QUESTIONS, MAX_TEAMS, type Errors, type FormState } from './model';
import { Field, Section, iconBtn, inputCls } from './ui';

type Patch = (fn: (f: FormState) => Partial<FormState>) => void;

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export function TeamsEditor({ form, errors, patch }: { form: FormState; errors: Errors; patch: Patch }) {
  const used = (id: string) => form.drivers.some((d) => d.teamId === id);
  function add() {
    patch((f) => {
      let n = f.teams.length + 1;
      while (f.teams.some((t) => t.id === `team-${n}`)) n++;
      return { teams: [...f.teams, { id: `team-${n}`, label: `Team ${n}` }] };
    });
  }
  return (
    <Section title="Teams" intro="Team answers use these. A team in use by a driver cannot be removed.">
      <ul className="space-y-3">
        {form.teams.map((t, i) => (
          <li key={t.id} className="flex items-end gap-2">
            <Field id={`team-${t.id}`} label={`Team ${i + 1}`} className="flex-1">
              <input
                id={`team-${t.id}`}
                className={inputCls}
                value={t.label}
                maxLength={40}
                onChange={(e) =>
                  patch((f) => ({ teams: f.teams.map((x) => (x.id === t.id ? { ...x, label: e.target.value } : x)) }))
                }
              />
            </Field>
            <button
              type="button"
              className={iconBtn}
              aria-label={`Remove ${t.label || `team ${i + 1}`}`}
              disabled={used(t.id) || form.teams.length <= 1}
              onClick={() => patch((f) => ({ teams: f.teams.filter((x) => x.id !== t.id) }))}
            >
              <Trash size={20} weight="regular" />
            </button>
          </li>
        ))}
      </ul>
      {errors.teams && (
        <p role="alert" className="mt-3 text-sm text-accent">
          {errors.teams}
        </p>
      )}
      <Button variant="secondary" className="mt-4" disabled={form.teams.length >= MAX_TEAMS} onClick={add}>
        <Plus size={20} weight="regular" /> Add team
      </Button>
    </Section>
  );
}

export function GridEditor({ form, errors, patch }: { form: FormState; errors: Errors; patch: Patch }) {
  return (
    <Section title="Starting grid" intro="Grid positions follow the row order. Use the arrows to reorder.">
      <ol className="divide-y divide-line border-y border-line">
        {form.drivers.map((d, i) => (
          <li key={d.id} className="grid grid-cols-[2.5rem_1fr_auto] items-end gap-x-3 gap-y-2 py-3 md:grid-cols-[3rem_1fr_1fr_auto]">
            <span className="pb-3 font-mono text-muted" aria-label={`Grid position ${i + 1}`}>
              P{i + 1}
            </span>
            <Field id={`drv-${d.id}`} label="Driver">
              <input
                id={`drv-${d.id}`}
                className={inputCls}
                value={d.label}
                maxLength={40}
                onChange={(e) =>
                  patch((f) => ({ drivers: f.drivers.map((x) => (x.id === d.id ? { ...x, label: e.target.value } : x)) }))
                }
              />
            </Field>
            <Field id={`drv-team-${d.id}`} label="Team" className="col-span-2 col-start-2 row-start-2 md:col-span-1 md:col-start-3 md:row-start-1">
              <select
                id={`drv-team-${d.id}`}
                className={inputCls}
                value={d.teamId}
                onChange={(e) =>
                  patch((f) => ({ drivers: f.drivers.map((x) => (x.id === d.id ? { ...x, teamId: e.target.value } : x)) }))
                }
              >
                {!form.teams.some((t) => t.id === d.teamId) && <option value="">Pick a team</option>}
                {form.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="col-start-3 row-start-1 flex gap-1 md:col-start-4">
              <button
                type="button"
                className={iconBtn}
                aria-label={`Move ${d.label || `row ${i + 1}`} up`}
                disabled={i === 0}
                onClick={() => patch((f) => ({ drivers: move(f.drivers, i, -1) }))}
              >
                <ArrowUp size={20} weight="regular" />
              </button>
              <button
                type="button"
                className={iconBtn}
                aria-label={`Move ${d.label || `row ${i + 1}`} down`}
                disabled={i === form.drivers.length - 1}
                onClick={() => patch((f) => ({ drivers: move(f.drivers, i, 1) }))}
              >
                <ArrowDown size={20} weight="regular" />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {errors.drivers && (
        <p role="alert" className="mt-3 text-sm text-accent">
          {errors.drivers}
        </p>
      )}
    </Section>
  );
}

export function QuestionsEditor({ form, errors, patch }: { form: FormState; errors: Errors; patch: Patch }) {
  const set = (id: string, p: Partial<FormState['questions'][number]>) =>
    patch((f) => ({ questions: f.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) }));
  return (
    <Section title="Questions" intro="Up to 8. Question ids stay fixed once issued, so existing picks keep matching.">
      <ol className="divide-y divide-line border-y border-line">
        {form.questions.map((q, i) => (
          <li key={q.id} className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_12rem_auto]">
            <Field id={`q-prompt-${q.id}`} label={`Question ${i + 1} prompt (${q.id})`}>
              <input id={`q-prompt-${q.id}`} className={inputCls} value={q.prompt} maxLength={140} onChange={(e) => set(q.id, { prompt: e.target.value })} />
            </Field>
            <Field id={`q-kind-${q.id}`} label="Answer kind">
              <select id={`q-kind-${q.id}`} className={inputCls} value={q.kind} onChange={(e) => set(q.id, { kind: e.target.value as 'team' | 'driver' })}>
                <option value="team">Team</option>
                <option value="driver">Driver</option>
              </select>
            </Field>
            <div className="flex items-end gap-1">
              <button type="button" className={iconBtn} aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => patch((f) => ({ questions: move(f.questions, i, -1) }))}>
                <ArrowUp size={20} weight="regular" />
              </button>
              <button type="button" className={iconBtn} aria-label={`Move question ${i + 1} down`} disabled={i === form.questions.length - 1} onClick={() => patch((f) => ({ questions: move(f.questions, i, 1) }))}>
                <ArrowDown size={20} weight="regular" />
              </button>
              <button type="button" className={iconBtn} aria-label={`Remove question ${i + 1}`} disabled={form.questions.length <= 1} onClick={() => patch((f) => ({ questions: f.questions.filter((x) => x.id !== q.id) }))}>
                <Trash size={20} weight="regular" />
              </button>
            </div>
            <Field id={`q-hint-${q.id}`} label="Hint (optional)" className="md:col-span-3">
              <input id={`q-hint-${q.id}`} className={inputCls} value={q.hint ?? ''} maxLength={200} onChange={(e) => set(q.id, { hint: e.target.value })} />
            </Field>
          </li>
        ))}
      </ol>
      {errors.questions && (
        <p role="alert" className="mt-3 text-sm text-accent">
          {errors.questions}
        </p>
      )}
      <Button
        variant="secondary"
        className="mt-4"
        disabled={form.questions.length >= MAX_QUESTIONS}
        onClick={() =>
          patch((f) => {
            const n = f.qCounter + 1;
            return { qCounter: n, questions: [...f.questions, { id: `q${n}`, prompt: '', kind: 'driver' }] };
          })
        }
      >
        <Plus size={20} weight="regular" /> Add question ({form.questions.length}/{MAX_QUESTIONS})
      </Button>
    </Section>
  );
}
