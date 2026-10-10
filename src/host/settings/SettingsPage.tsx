import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowSquareOut, FloppyDisk, Broadcast } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { Link, Outlet, useOutletContext } from 'react-router';
import FailurePage from '../../components/FailurePage';
import Skeleton, { Busy } from '../../components/Skeleton';
import { useTimedOut } from '../../lib/useTimedOut';
import { ALL_RACES, getRace } from '../../config/calendar';
import { getEventConfig, saveEventConfig, setActiveEvent } from '../../lib/db';
import { QuestionsEditor } from './Editors';
import { GridView, RefreshGridButton, TeamsView, useGridRefresh } from './GridTeamsView';
import {
  compute,
  configToForm,
  customForm,
  formToConfig,
  quizWindowSummary,
  raceToForm,
  validate,
  type FormState,
} from './model';
import { Field, Section, TimeTriple, inputCls, linkBtn } from './ui';
import { QuizTabs } from './QuizTabs';
import { SECTION } from '../nav';

/** Shared by the layout route and its tab routes: the one FormState for the whole event lives in
 * SettingsPage (the parent route element), so switching tabs never drops unsaved edits. */
export interface SettingsCtx {
  form: FormState;
  errors: ReturnType<typeof validate>;
  comp: ReturnType<typeof compute>;
  patch: (fn: (f: FormState) => Partial<FormState>) => void;
  touched: boolean;
  pickErr: string | null;
  pickRace: (id: string) => Promise<void>;
  gridRefresh: ReturnType<typeof useGridRefresh>;
  race: ReturnType<typeof getRace>;
}

const useSettings = () => useOutletContext<SettingsCtx>();

const snap = (f: FormState) => JSON.stringify(f);
const CUSTOM = 'custom';

/** The quiz editor for ONE booking event (R57), mounted at /host/bookings/:eventId/quiz. `quizId` is the
 * `events/{id}` doc that belongs to the watch party; the form is lifted here so tab switches keep edits. */
export default function SettingsPage({ bookingEventId, quizId, title }: { bookingEventId: string; quizId: string; title: string }) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'live'>(null);
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const init = useRef(false);
  const stuck = useTimedOut(!form && !loadErr);

  useEffect(() => {
    if (init.current) return;
    init.current = true;
    (async () => {
      try {
        const existing = await getEventConfig(quizId);
        if (!existing) throw new Error('This watch party\'s quiz could not be found.');
        const f = configToForm(existing);
        setForm(f);
        setSaved(snap(f));
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Could not load the event.');
      }
    })();
  }, [quizId]);

  const patch = useCallback((fn: (f: FormState) => Partial<FormState>) => {
    setBanner(null);
    setForm((f) => (f ? { ...f, ...fn(f) } : f));
  }, []);

  const errors = useMemo(() => (form ? validate(form) : {}), [form]);
  const dirty = form ? snap(form) !== saved : false;
  const comp = useMemo(() => (form ? compute(form) : null), [form]);
  const formRace = form ? (getRace(form.raceId) ?? null) : null;
  const gridRefresh = useGridRefresh(form, patch, formRace);

  async function pickRace(id: string) {
    setPickErr(null);
    setBanner(null);
    try {
      const race = id === CUSTOM ? null : getRace(id);
      if (id !== CUSTOM && !race) return;
      const next = race ? await raceToForm(race) : await customForm();
      // Picking a race re-seeds the content, but this stays the SAME quiz doc and keeps its live state.
      setForm((cur) =>
        cur
          ? {
              ...next,
              id: cur.id,
              createdAtMs: cur.createdAtMs,
              override: cur.override,
              winnerRevealed: cur.winnerRevealed,
              tiebreakOverride: cur.tiebreakOverride,
              raceStartedAtMs: cur.raceStartedAtMs,
            }
          : cur,
      );
    } catch (e) {
      setPickErr(e instanceof Error ? e.message : 'Could not load that race.');
    }
  }

  async function save(makeLive: boolean) {
    setTouched(true);
    if (!form) return;
    if (Object.keys(errors).length > 0) {
      setBanner({ ok: false, msg: 'Fix the highlighted fields before saving.' });
      return;
    }
    setBusy(makeLive ? 'live' : 'save');
    setBanner(null);
    try {
      await saveEventConfig(formToConfig(form));
      setSaved(snap(form));
      if (makeLive) await setActiveEvent(form.id);
      setBanner({ ok: true, msg: makeLive ? 'Saved. This is now the live quiz.' : 'Quiz saved.' });
    } catch (e) {
      setBanner({ ok: false, msg: e instanceof Error ? e.message : 'Save failed. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  if (loadErr || stuck)
    return <FailurePage error={loadErr ?? 'The event did not load in time.'} />;

  if (!form || !comp)
    return (
      <Busy className="py-6">
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      </Busy>
    );

  const race = getRace(form.raceId);
  const busyAny = busy !== null;
  const ctx: SettingsCtx = { form, errors, comp, patch, touched, pickErr, pickRace, gridRefresh, race };

  return (
    <div className="pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
        <Link
          to={`/host/${SECTION.bookings}`}
          className="inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ArrowLeft size={20} weight="regular" aria-hidden="true" /> Booking events
        </Link>
        <p className="font-mono text-sm" data-testid="dirty-indicator" role="status">
          {dirty ? <span className="text-accent-text">Unsaved changes</span> : <span className="text-muted">All changes saved</span>}
        </p>
      </div>
      <h2 className="text-2xl font-semibold md:text-3xl">Quiz</h2>
      <p className="mt-1 text-muted">{title}</p>

      <div className="mt-4">
        <QuizTabs eventId={bookingEventId} />
      </div>
      <div className="pt-6">
        <Outlet context={ctx} />
      </div>

      <div className="sticky bottom-0 z-10 mt-6 border-t border-line bg-base/95 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={busyAny} onClick={() => void save(false)}>
            <FloppyDisk size={20} weight="regular" aria-hidden="true" /> {busy === 'save' ? 'Saving...' : 'Save quiz'}
          </Button>
          <Button variant="secondary" disabled={busyAny} onClick={() => void save(true)}>
            <Broadcast size={20} weight="regular" aria-hidden="true" /> {busy === 'live' ? 'Going live...' : 'Make this the live quiz'}
          </Button>
          {banner && (
            <p role={banner.ok ? 'status' : 'alert'} data-testid="save-banner" className={banner.ok ? 'text-ink' : 'text-accent-text'}>
              {banner.msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- tab routes: /host/bookings/:eventId/quiz/{details,grid,teams,questions} ---------------- */

export function SettingsDetailsTab() {
  const { form, errors, comp, patch, touched, pickErr, pickRace, race } = useSettings();
  const show = (k: keyof typeof errors) => (touched || form[k as keyof FormState] !== '' ? errors[k] : undefined);
  const pickerValue = form.raceId === CUSTOM ? CUSTOM : form.raceId;
  const seasons = [2026, 2027] as const;
  const whatsappErr = errors.whatsapp;
  return (
    <>
      <Section title="Race" intro="Pick a race to re-seed this quiz from it, or start a custom quiz.">
        <Field id="race-picker" label="Race" error={pickErr ?? undefined} className="max-w-2xl">
          <select id="race-picker" className={inputCls} value={pickerValue} onChange={(e) => void pickRace(e.target.value)}>
            <option value={CUSTOM}>Custom event</option>
            {seasons.map((s) => (
              <optgroup key={s} label={`${s} season`}>
                {ALL_RACES.filter((r) => r.season === s).map((r) => (
                  <option key={r.id} value={r.id} disabled={r.status === 'cancelled-by-host'}>
                    R{r.round} {r.name} ({r.weekendStart} to {r.weekendEnd})
                    {r.status === 'cancelled-by-host' ? ' - cancelled' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <p className="mt-2 text-sm text-muted">Races cancelled by the host are listed but cannot be chosen.</p>
        {race && (
          <p className="mt-3 font-mono text-sm text-muted">
            {race.season} round {race.round} / race day {race.raceDate}
          </p>
        )}
      </Section>

      <Section title="Details">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <Field id="f-name" label="Event name" error={show('name')}>
            <input id="f-name" className={inputCls} value={form.name} maxLength={80} aria-invalid={!!show('name')} onChange={(e) => patch(() => ({ name: e.target.value }))} />
          </Field>
          <Field id="f-sub" label="Subtitle" error={show('subtitle')}>
            <input id="f-sub" className={inputCls} value={form.subtitle} maxLength={120} onChange={(e) => patch(() => ({ subtitle: e.target.value }))} />
          </Field>
          <Field id="f-circuit" label="Circuit" error={show('circuit')}>
            <input id="f-circuit" className={inputCls} value={form.circuit} maxLength={80} onChange={(e) => patch(() => ({ circuit: e.target.value }))} />
          </Field>
        </div>
      </Section>

      <Section title="Timing" intro="Times are entered in your local time. Every instant is also shown in IST and UTC.">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <Field id="f-start" label="Race start (your local time)" error={errors.start}>
              <input id="f-start" type="datetime-local" className={`${inputCls} font-mono`} value={form.start} aria-invalid={!!errors.start} onChange={(e) => patch(() => ({ start: e.target.value }))} />
            </Field>
            <TimeTriple label="Race start" ms={comp.startMs} testId="start-readout" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="f-duration" label="Normal race duration (minutes)" error={errors.duration}>
              <input id="f-duration" type="number" inputMode="numeric" min={30} max={180} className={`${inputCls} font-mono`} value={form.duration} aria-invalid={!!errors.duration} onChange={(e) => patch(() => ({ duration: e.target.value }))} />
            </Field>
            <Field id="f-laps" label="Total laps" error={show('totalLaps')} hint="From the race facts. Empty closes on the clock only.">
              <input id="f-laps" type="number" inputMode="numeric" min={1} max={100} className={`${inputCls} font-mono`} value={form.totalLaps} aria-invalid={!!show('totalLaps')} onChange={(e) => patch(() => ({ totalLaps: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-8 rounded-lg border border-line p-4" data-testid="quiz-window-summary">
          <p className="text-sm font-medium text-muted">Quiz window</p>
          <p className="mt-1">{Number.isFinite(comp.opensMs) ? quizWindowSummary(comp) : '--'}</p>
          <p className="mt-1 text-sm text-muted">
            If the start is delayed, mark it delayed in Live controls and the clock waits; pressing Lights out restarts the 30% clock from the actual start.
          </p>
          {form.raceStartedAtMs !== null && (
            <p className="mt-2 text-sm text-ink">Lights out is recorded, so the window is run from Live controls now. Window changes here are not saved.</p>
          )}
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <TimeTriple label="Quiz opens" ms={comp.opensMs} testId="auto-opens" />
          <TimeTriple label="Quiz closes (clock backstop)" ms={comp.closesMs} testId="auto-closes" />
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Field id="f-opens" label="Open later (optional)" hint="Empty opens 10 minutes before lights out. Earlier times are pulled back.">
            <input id="f-opens" type="datetime-local" className={`${inputCls} font-mono`} value={form.opensOverride} disabled={form.raceStartedAtMs !== null} onChange={(e) => patch(() => ({ opensOverride: e.target.value }))} />
          </Field>
          <Field id="f-closes" label="Close earlier (optional)" hint="Empty closes at 30% of the race. Later times are pulled back.">
            <input id="f-closes" type="datetime-local" className={`${inputCls} font-mono`} value={form.closesOverride} disabled={form.raceStartedAtMs !== null} onChange={(e) => patch(() => ({ closesOverride: e.target.value }))} />
          </Field>
        </div>
        {comp.notes.length > 0 && (
          <ul className="mt-4 space-y-1 text-sm text-accent-text" data-testid="window-notes">
            {comp.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        {errors.window && (
          <p role="alert" className="mt-4 text-sm text-accent-text">
            {errors.window}
          </p>
        )}
      </Section>

      <Section title="WhatsApp community" intro="Shown to guests as a join button. Leave empty to hide it.">
        <div className="flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end">
          <Field id="f-wa" label="Community link" error={whatsappErr} className="flex-1">
            <input
              id="f-wa"
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://chat.whatsapp.com/..."
              className={`${inputCls} font-mono`}
              value={form.whatsapp}
              aria-invalid={!!whatsappErr}
              aria-describedby={whatsappErr ? 'f-wa-err' : undefined}
              onChange={(e) => patch(() => ({ whatsapp: e.target.value.trim() }))}
            />
          </Field>
          {form.whatsapp && !whatsappErr ? (
            <a href={form.whatsapp} target="_blank" rel="noopener noreferrer" className={linkBtn}>
              <ArrowSquareOut size={20} weight="regular" aria-hidden="true" /> Test link
            </a>
          ) : (
            <span aria-disabled="true" className={`${linkBtn} pointer-events-none opacity-50`}>
              <ArrowSquareOut size={20} weight="regular" aria-hidden="true" /> Test link
            </span>
          )}
        </div>
      </Section>

      <p className="mt-2 font-mono text-sm text-muted">
        {form.drivers.length} drivers / {form.teams.length} teams / {form.questions.length} questions
      </p>
      {/* NEW SETTINGS SECTIONS GO HERE: add another <Section title="..."> above this comment
          (e.g. the refund cutoff). Add its field to FormState in ./model and read it from useSettings(). */}
    </>
  );
}

export function SettingsGridTab() {
  const { form, gridRefresh, race } = useSettings();
  return (
    <>
        <div className="flex justify-end">
        <RefreshGridButton busy={gridRefresh.busy} onRefresh={() => void gridRefresh.refresh()} disabled={!race} />
      </div>
      <GridView form={form} />
    </>
  );
}

export function SettingsTeamsTab() {
  const { form, gridRefresh, race } = useSettings();
  return (
    <>
        <div className="flex justify-end">
        <RefreshGridButton busy={gridRefresh.busy} onRefresh={() => void gridRefresh.refresh()} disabled={!race} />
      </div>
      <TeamsView form={form} />
    </>
  );
}

export function SettingsQuestionsTab() {
  const { form, errors, patch } = useSettings();
  return (
        <QuestionsEditor form={form} errors={errors} patch={patch} />
  );
}
