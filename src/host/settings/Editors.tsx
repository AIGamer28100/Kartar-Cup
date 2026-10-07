import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { MAX_QUESTION_POINTS, type QuestionKind } from '../../lib/types';
import { MAX_QUESTIONS, type Errors, type FormState } from './model';
import { Field, Section, iconBtn, inputCls } from './ui';

type Patch = (fn: (f: FormState) => Partial<FormState>) => void;

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export function QuestionsEditor({ form, errors, patch }: { form: FormState; errors: Errors; patch: Patch }) {
  const set = (id: string, p: Partial<FormState['questions'][number]>) =>
    patch((f) => ({ questions: f.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) }));
  return (
    <Section title="Questions" intro="Up to 8. Question ids stay fixed once issued, so existing picks keep matching. Points (1 to 10) is what a right answer adds to the score.">
      <ol className="divide-y divide-line border-y border-line">
        {form.questions.map((q, i) => (
          <li key={q.id} className="grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_12rem_6rem_auto]">
            <Field id={`q-prompt-${q.id}`} label={`Question ${i + 1} prompt (${q.id})`}>
              <input id={`q-prompt-${q.id}`} className={inputCls} value={q.prompt} maxLength={80} onChange={(e) => set(q.id, { prompt: e.target.value })} />
            </Field>
            <Field id={`q-kind-${q.id}`} label="Answer kind">
              <select id={`q-kind-${q.id}`} className={inputCls} value={q.kind} onChange={(e) => set(q.id, { kind: e.target.value as QuestionKind })}>
                <option value="team">Team</option>
                <option value="driver">Driver</option>
                <option value="yesno">Yes / No</option>
              </select>
            </Field>
            <Field id={`q-points-${q.id}`} label="Points">
              <input
                id={`q-points-${q.id}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_QUESTION_POINTS}
                step={1}
                className={`${inputCls} font-mono tabular-nums`}
                value={q.points ?? 1}
                onChange={(e) => set(q.id, { points: Math.min(MAX_QUESTION_POINTS, Math.max(1, Math.round(Number(e.target.value)) || 1)) })}
              />
            </Field>
            <div className="flex items-end gap-1">
              <button type="button" className={iconBtn} aria-label={`Move question ${i + 1} up`} disabled={i === 0} onClick={() => patch((f) => ({ questions: move(f.questions, i, -1) }))}>
                <ArrowUp size={20} weight="regular" aria-hidden="true" />
              </button>
              <button type="button" className={iconBtn} aria-label={`Move question ${i + 1} down`} disabled={i === form.questions.length - 1} onClick={() => patch((f) => ({ questions: move(f.questions, i, 1) }))}>
                <ArrowDown size={20} weight="regular" aria-hidden="true" />
              </button>
              <button type="button" className={iconBtn} aria-label={`Remove question ${i + 1}`} disabled={form.questions.length <= 1} onClick={() => patch((f) => ({ questions: f.questions.filter((x) => x.id !== q.id) }))}>
                <Trash size={20} weight="regular" aria-hidden="true" />
              </button>
            </div>
            <Field id={`q-hint-${q.id}`} label="Hint (optional)" className="md:col-span-4">
              <input id={`q-hint-${q.id}`} className={inputCls} value={q.hint ?? ''} maxLength={160} onChange={(e) => set(q.id, { hint: e.target.value })} />
            </Field>
          </li>
        ))}
      </ol>
      {errors.questions && (
        <p role="alert" className="mt-3 text-sm text-accent-text">
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
        <Plus size={20} weight="regular" aria-hidden="true" /> Add question ({form.questions.length}/{MAX_QUESTIONS})
      </Button>
    </Section>
  );
}
