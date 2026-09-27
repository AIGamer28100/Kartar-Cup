import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowSquareOut, FloppyDisk, Broadcast } from '@phosphor-icons/react';
import Button from '../../components/Button';
import Skeleton from '../../components/Skeleton';
import { ALL_RACES, nextRace, getRace } from '../../config/calendar';
import { getActiveEventId, saveEventConfig, setActiveEvent, watchEventConfig } from '../../lib/db';
import type { EventConfig } from '../../lib/types';
import { GridEditor, QuestionsEditor, TeamsEditor } from './Editors';
import LiveControls from './LiveControls';
import {
  compute,
  configToForm,
  customForm,
  formToConfig,
  raceToForm,
  validate,
  type FormState,
} from './model';
import { Field, Section, TimeTriple, inputCls, linkBtn, sectionId } from './ui';

const NAV = ['Live controls', 'Race', 'Details', 'Timing', 'WhatsApp community', 'Teams', 'Starting grid', 'Questions'];
import { fromLocalInput } from './time';

/** One-shot read of an event config via the existing watcher (no getDoc helper in db.ts). */
function readEvent(id: string): Promise<EventConfig | null> {
  return new Promise((resolve, reject) => {
    let unsub: (() => void) | null = null;
    let done = false;
    unsub = watchEventConfig(
      id,
      (c) => {
        done = true;
        unsub?.();
        resolve(c);
      },
      reject,
    );
    if (done) unsub();
  });
}

const snap = (f: FormState) => JSON.stringify(f);
const CUSTOM = 'custom';

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'save' | 'live'>(null);
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [pickErr, setPickErr] = useState<string | null>(null);
  const init = useRef(false);

  useEffect(() => {
    if (init.current) return;
    init.current = true;
    (async () => {
      try {
        const activeId = await getActiveEventId();
        const existing = activeId ? await readEvent(activeId) : null;
        const f = existing
          ? configToForm(existing)
          : raceToForm(nextRace(new Date(), ALL_RACES) ?? ALL_RACES[0]);
        setForm(f);
        setSaved(existing ? snap(f) : '');
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Could not load the event.');
      }
    })();
  }, []);

  const patch = useCallback((fn: (f: FormState) => Partial<FormState>) => {
    setBanner(null);
    setForm((f) => (f ? { ...f, ...fn(f) } : f));
  }, []);

  const errors = useMemo(() => (form ? validate(form) : {}), [form]);
  const dirty = form ? snap(form) !== saved : false;
  const comp = useMemo(() => (form ? compute(form) : null), [form]);

  async function pickRace(id: string) {
    setPickErr(null);
    setBanner(null);
    try {
      if (id === CUSTOM) {
        setForm(customForm());
        return;
      }
      const race = getRace(id);
      if (!race) return;
      const existing = await readEvent(race.id);
      setForm(existing ? configToForm(existing) : raceToForm(race));
      if (existing) setSaved(snap(configToForm(existing)));
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
      setBanner({ ok: true, msg: makeLive ? 'Saved. This is now the live event.' : 'Event saved.' });
    } catch (e) {
      setBanner({ ok: false, msg: e instanceof Error ? e.message : 'Save failed. Try again.' });
    } finally {
      setBusy(null);
    }
  }

  const backLink = (
    <a href="/host" className="inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink">
      <ArrowLeft size={20} weight="regular" /> Race control
    </a>
  );

  if (loadErr)
    return (
      <div className="py-8">
        {backLink}
        <p role="alert" className="mt-6 text-3xl text-accent">
          Could not load the event.
        </p>
        <p className="mt-2 text-muted">{loadErr}</p>
      </div>
    );

  if (!form || !comp)
    return (
      <div className="py-8" aria-busy="true">
        {backLink}
        <div className="mt-6 space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );

  const show = (k: keyof typeof errors) => (touched || form[k as keyof FormState] !== '' ? errors[k] : undefined);
  const race = getRace(form.raceId);
  const pickerValue = form.raceId === CUSTOM ? CUSTOM : form.raceId;
  const seasons = [2026, 2027] as const;
  const whatsappErr = errors.whatsapp;
  const busyAny = busy !== null;

  return (
    <div className="pb-32">
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        {backLink}
        <p className="font-mono text-sm" data-testid="dirty-indicator" role="status">
          {dirty ? <span className="text-accent">Unsaved changes</span> : <span className="text-muted">All changes saved</span>}
        </p>
      </div>
      <h2 className="text-3xl font-semibold md:text-4xl">Event settings</h2>

      <div className="lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav aria-label="Settings sections" className="sticky top-6 mt-8">
          <ul className="m-0 list-none border-l border-line p-0">
            {NAV.map((t) => (
              <li key={t}>
                <a href={`#${sectionId(t)}`} className="flex min-h-11 items-center pl-4 text-muted transition-colors duration-150 hover:text-ink">
                  {t}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-6 font-mono text-sm text-muted">{form.drivers.length} drivers / {form.teams.length} teams / {form.questions.length} questions</p>
        </nav>
      </aside>
      <div className="min-w-0">
      <LiveControls />

      <Section title="Race" intro="Pick a race to pre-fill the form, or start a custom event.">
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
          <div>
            <Field id="f-duration" label="Normal race duration (minutes)" error={errors.duration}>
              <input id="f-duration" type="number" inputMode="numeric" min={10} max={600} className={`${inputCls} font-mono`} value={form.duration} aria-invalid={!!errors.duration} onChange={(e) => patch(() => ({ duration: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <TimeTriple label="Quiz opens (at lights-out)" ms={comp.autoOpensMs} testId="auto-opens" />
          <TimeTriple label="Quiz closes (90% of normal race)" ms={comp.autoClosesMs} testId="auto-closes" />
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <Field id="f-opens" label="Opens at override (optional)" hint="Empty uses the automatic time.">
              <input id="f-opens" type="datetime-local" className={`${inputCls} font-mono`} value={form.opensOverride} onChange={(e) => patch(() => ({ opensOverride: e.target.value }))} />
            </Field>
            {!Number.isNaN(fromLocalInput(form.opensOverride)) && <TimeTriple label="Opens at (effective)" ms={comp.opensMs} />}
          </div>
          <div className="space-y-3">
            <Field id="f-closes" label="Closes at override (optional)" hint="Empty uses the automatic time.">
              <input id="f-closes" type="datetime-local" className={`${inputCls} font-mono`} value={form.closesOverride} onChange={(e) => patch(() => ({ closesOverride: e.target.value }))} />
            </Field>
            {!Number.isNaN(fromLocalInput(form.closesOverride)) && <TimeTriple label="Closes at (effective)" ms={comp.closesMs} />}
          </div>
        </div>
        {errors.window && (
          <p role="alert" className="mt-4 text-sm text-accent">
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
              <ArrowSquareOut size={20} weight="regular" /> Test link
            </a>
          ) : (
            <span aria-disabled="true" className={`${linkBtn} pointer-events-none opacity-50`}>
              <ArrowSquareOut size={20} weight="regular" /> Test link
            </span>
          )}
        </div>
      </Section>

      <TeamsEditor form={form} errors={errors} patch={patch} />
      <GridEditor form={form} errors={errors} patch={patch} />
      <QuestionsEditor form={form} errors={errors} patch={patch} />
      </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-base/95 px-6 py-3 backdrop-blur md:px-10 lg:px-16">
        <div className="mx-auto flex max-w-[87.5rem] flex-wrap items-center gap-3">
          <Button disabled={busyAny} onClick={() => void save(false)}>
            <FloppyDisk size={20} weight="regular" /> {busy === 'save' ? 'Saving...' : 'Save event'}
          </Button>
          <Button variant="secondary" disabled={busyAny} onClick={() => void save(true)}>
            <Broadcast size={20} weight="regular" /> {busy === 'live' ? 'Going live...' : 'Set as live event'}
          </Button>
          {banner && (
            <p role={banner.ok ? 'status' : 'alert'} data-testid="save-banner" className={banner.ok ? 'text-ink' : 'text-accent'}>
              {banner.msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
