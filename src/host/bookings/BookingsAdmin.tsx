import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FloppyDisk, Plus } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import { createBookingEvent, updateBookingEvent, watchAllBookingEvents } from '../../lib/bookings';
import type { BookingEvent } from '../../lib/types';
import { fmtLocal } from '../settings/time';
import { Field, Section, inputCls } from '../settings/ui';
import { useSchedule } from '../../lib/useSchedule';
import AttendeeRoster from './AttendeeRoster';
import { DiscountsEditor, TiersEditor } from './Editors';
import VenueSearch from './VenueSearch';
import {
  blankForm,
  eventToForm,
  formToEvent,
  raceDefaultDateUtc,
  upcomingRaceOptions,
  validate,
  type FormState,
} from './model';

const snap = (f: FormState) => JSON.stringify(f);

export default function BookingsAdmin() {
  const [events, setEvents] = useState<BookingEvent[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [rosterId, setRosterId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = watchAllBookingEvents(
      (evs) => setEvents([...evs].sort((a, b) => a.dateUtc.localeCompare(b.dateUtc))),
      () => setEvents([]),
    );
    return unsub;
  }, []);

  const patch = useCallback((fn: (f: FormState) => Partial<FormState>) => {
    setBanner(null);
    setForm((f) => (f ? { ...f, ...fn(f) } : f));
  }, []);

  const errors = useMemo(() => (form ? validate(form) : {}), [form]);
  const dirty = form ? snap(form) !== saved : false;
  const { schedule } = useSchedule(2026);
  const { schedule: schedule27 } = useSchedule(2027);
  const raceOptions = useMemo(() => upcomingRaceOptions(new Date(), 5, form?.raceId || undefined), [form?.raceId]);

  function openNew() {
    setBanner(null);
    setTouched(false);
    const f = blankForm();
    setForm(f);
    setSaved('');
  }

  function openEdit(ev: BookingEvent) {
    setBanner(null);
    setTouched(false);
    const f = eventToForm(ev);
    setForm(f);
    setSaved(snap(f));
  }

  function closeForm() {
    setForm(null);
    setBanner(null);
  }

  async function save() {
    setTouched(true);
    if (!form) return;
    if (Object.keys(errors).length > 0) {
      setBanner({ ok: false, msg: 'Fix the highlighted fields before saving.' });
      return;
    }
    setBusy(true);
    setBanner(null);
    try {
      const payload = formToEvent(form);
      if (form.id) await updateBookingEvent(form.id, payload);
      else await createBookingEvent(payload);
      setSaved(snap(form));
      setBanner({ ok: true, msg: 'Booking event saved.' });
    } catch (e) {
      setBanner({ ok: false, msg: e instanceof Error ? e.message : 'Save failed. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  const backLink = (
    <button type="button" onClick={closeForm} className="inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink">
      <ArrowLeft size={20} weight="regular" /> Booking events
    </button>
  );

  if (form) {
    const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);
    return (
      <div className="pb-32">
        <div className="flex flex-wrap items-center justify-between gap-3 py-4">
          {backLink}
          <p className="font-mono text-sm" role="status">
            {dirty ? <span className="text-accent">Unsaved changes</span> : <span className="text-muted">All changes saved</span>}
          </p>
        </div>
        <h2 className="text-2xl font-semibold md:text-3xl">{form.id ? 'Edit booking event' : 'New booking event'}</h2>

        <Section title="Details">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            <Field id="f-title" label="Title" error={show('title')}>
              <input
                id="f-title"
                className={inputCls}
                value={form.title}
                maxLength={120}
                aria-invalid={!!show('title')}
                onChange={(e) => patch(() => ({ title: e.target.value }))}
              />
            </Field>
            <Field
              id="f-raceid"
              label="Linked race"
              hint="Pulls the race's start time (minus a 30-min arrival buffer) into Date & time. Required for this event's tickets to show up on /events."
            >
              <select
                id="f-raceid"
                className={inputCls}
                value={form.raceId}
                onChange={(e) => {
                  const id = e.target.value;
                  const race = raceOptions.find((r) => r.id === id);
                  patch(() => ({ raceId: id, ...(race ? { dateUtc: raceDefaultDateUtc(race, race.season === 2027 ? schedule27 : schedule) } : {}) }));
                }}
              >
                <option value="">Not linked to a calendar race</option>
                {raceOptions.map((r) => (
                  <option key={r.id} value={r.id}>
                    R{r.round} {r.name} ({r.raceDate})
                  </option>
                ))}
              </select>
            </Field>
            <Field id="f-date" label="Date & time" error={show('dateUtc')}>
              <input
                id="f-date"
                type="datetime-local"
                className={`${inputCls} font-mono`}
                value={form.dateUtc}
                aria-invalid={!!show('dateUtc')}
                onChange={(e) => patch(() => ({ dateUtc: e.target.value }))}
              />
            </Field>
            <Field id="f-capacity" label="Capacity" error={show('capacity')}>
              <input
                id="f-capacity"
                type="number"
                inputMode="numeric"
                min={1}
                className={`${inputCls} font-mono`}
                value={form.capacity}
                aria-invalid={!!show('capacity')}
                onChange={(e) => patch(() => ({ capacity: e.target.value }))}
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium text-muted">
              <input type="checkbox" checked={form.salesOpen} onChange={(e) => patch(() => ({ salesOpen: e.target.checked }))} />
              Open for sales
            </label>
          </div>
          <div className="mt-5 max-w-2xl">
            <Field
              id="f-policy"
              label="Cancellation & refund policy (optional)"
              hint="Shown to guests before they pay and on their ticket. For example: “No refunds. Tickets can be transferred to a friend until the day before.”"
              error={show('policy')}
            >
              <textarea
                id="f-policy"
                rows={3}
                maxLength={300}
                className={`${inputCls} py-2`}
                value={form.policy}
                aria-invalid={!!show('policy')}
                onChange={(e) => patch(() => ({ policy: e.target.value }))}
              />
            </Field>
          </div>
        </Section>

        <Section title="Venue">
          <VenueSearch
            onPick={(p) => patch(() => ({ venueName: p.name, venueCity: p.city, venueMapUrl: p.mapUrl }))}
          />
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Field id="f-venue-name" label="Name" error={show('venueName')}>
              <input
                id="f-venue-name"
                className={inputCls}
                value={form.venueName}
                aria-invalid={!!show('venueName')}
                onChange={(e) => patch(() => ({ venueName: e.target.value }))}
              />
            </Field>
            <Field id="f-venue-city" label="City" error={show('venueCity')}>
              <input
                id="f-venue-city"
                className={inputCls}
                value={form.venueCity}
                aria-invalid={!!show('venueCity')}
                onChange={(e) => patch(() => ({ venueCity: e.target.value }))}
              />
            </Field>
            <Field
              id="f-venue-map"
              label="Map link (optional)"
              hint="Optional. Paste a Google Maps link for an exact pin; leave blank and the map is found from the venue name and city."
            >
              <input
                id="f-venue-map"
                type="url"
                className={inputCls}
                value={form.venueMapUrl}
                onChange={(e) => patch(() => ({ venueMapUrl: e.target.value }))}
              />
            </Field>
            <Field id="f-venue-cap" label="Default capacity (optional)">
              <input
                id="f-venue-cap"
                type="number"
                inputMode="numeric"
                min={0}
                className={`${inputCls} font-mono`}
                value={form.venueCapacityDefault}
                onChange={(e) => patch(() => ({ venueCapacityDefault: e.target.value }))}
              />
            </Field>
          </div>
        </Section>

        <TiersEditor form={form} errors={errors} patch={patch} />
        <DiscountsEditor form={form} errors={errors} patch={patch} />

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-base/95 px-6 py-3 backdrop-blur md:px-10 lg:px-16">
          <div className="mx-auto flex max-w-[87.5rem] flex-wrap items-center gap-3">
            <Button disabled={busy} onClick={() => void save()}>
              <FloppyDisk size={20} weight="regular" /> {busy ? 'Saving...' : 'Save event'}
            </Button>
            {banner && (
              <p role={banner.ok ? 'status' : 'alert'} className={banner.ok ? 'text-ink' : 'text-accent'}>
                {banner.msg}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const rosterEvent = rosterId ? events?.find((e) => e.id === rosterId) : undefined;
  if (rosterEvent) return <AttendeeRoster event={rosterEvent} onBack={() => setRosterId(null)} />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Booking events</h2>
        <Button onClick={openNew}>
          <Plus size={20} weight="regular" /> New booking event
        </Button>
      </div>

      {events === null && <RowsSkeleton />}

      {events !== null && events.length === 0 && (
        <p className="mt-6 text-muted">No booking events yet — create one to get started.</p>
      )}

      {events !== null && events.length > 0 && (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {events.map((ev) => (
            <li key={ev.id} className="grid grid-cols-1 gap-2 py-4 md:grid-cols-[1fr_10rem_8rem_8rem_6rem_auto] md:items-center md:gap-4">
              <div>
                <p className="font-medium">{ev.title}</p>
                <p className="font-mono text-sm text-muted">{ev.venue.name}</p>
              </div>
              <p className="font-mono text-sm text-muted">{fmtLocal(new Date(ev.dateUtc).getTime())}</p>
              <p className="font-mono text-sm">{ev.bookedCount} / {ev.capacity}</p>
              <p className="text-sm text-muted">{ev.venue.city}</p>
              <span
                className={`inline-flex w-fit min-h-6 items-center rounded-full px-2.5 text-xs font-medium ${
                  ev.salesOpen ? 'bg-accent/15 text-accent' : 'bg-raised text-muted'
                }`}
              >
                {ev.salesOpen ? 'Open' : 'Closed'}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setRosterId(ev.id)}>
                  Attendees
                </Button>
                <Button variant="secondary" onClick={() => openEdit(ev)}>
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
