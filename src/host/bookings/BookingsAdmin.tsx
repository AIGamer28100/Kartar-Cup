import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FloppyDisk, Plus } from '@phosphor-icons/react';
import { useMatch, useNavigate, useParams, Outlet } from 'react-router';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import { deleteField } from 'firebase/firestore';
import { createBookingEvent, updateBookingEvent, watchAllBookingEvents, watchBookingEvent, cancelBookingEvent, settleCancelledEvent, pendingEventRefunds } from '../../lib/bookings';
import { useAuth } from '../../lib/auth';
import { permissionHint } from '../../lib/permissionHint';
import type { BookingEvent, EventCategory } from '../../lib/types';
import { fmtLocal } from '../settings/time';
import { Field, Section, inputCls } from '../settings/ui';
import { useSchedule } from '../../lib/useSchedule';
import { DiscountsEditor, TiersEditor } from './Editors';
import VenueSearch from './VenueSearch';
import AttendeeRoster from './AttendeeRoster';
import CardsAdmin from './CardsAdmin';
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

/** Nested route: Edit or create booking event form. */
export function BookingEventForm() {
  const { access } = useAuth();
  const { eventId } = useParams<{ eventId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(eventId);

  const [form, setForm] = useState<FormState | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);
  const [touched, setTouched] = useState(false);

  const { schedule } = useSchedule(2026);
  const { schedule: schedule27 } = useSchedule(2027);
  const raceOptions = useMemo(() => upcomingRaceOptions(new Date(), 5, form?.raceId || undefined), [form?.raceId]);

  const [notFound, setNotFound] = useState(false);
  useEffect(() => {
    setNotFound(false);
    if (!isEditing || !eventId) {
      const f = blankForm();
      setForm(f);
      setSaved(snap(f));
      return;
    }
    return watchBookingEvent(
      eventId,
      (ev) => {
        if (!ev) return setNotFound(true);
        // Only seed once: later snapshots must not clobber what the host is typing.
        setForm((cur) => {
          if (cur) return cur;
          const f = eventToForm(ev);
          setSaved(snap(f));
          return f;
        });
      },
      () => setNotFound(true),
    );
  }, [eventId, isEditing]);

  const patch = useCallback((fn: (f: FormState) => Partial<FormState>) => {
    setBanner(null);
    setForm((f) => (f ? { ...f, ...fn(f) } : f));
  }, []);

  const errors = useMemo(() => (form ? validate(form) : {}), [form]);
  const dirty = form ? snap(form) !== saved : false;

  function closeForm() {
    navigate('..', { replace: true });
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
      if (form.id) await updateBookingEvent(form.id, payload.raceId ? payload : { ...payload, raceId: deleteField() as unknown as undefined });
      else await createBookingEvent(payload);
      setSaved(snap(form));
      setBanner({ ok: true, msg: 'Booking event saved.' });
      navigate('..', { replace: true });
    } catch (e) {
      setBanner({ ok: false, msg: permissionHint(e, 'bookings', access, 'save this booking event') });
    } finally {
      setBusy(false);
    }
  }

  const backLink = (
    <button type="button" onClick={closeForm} className="inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink">
      <ArrowLeft size={20} weight="regular" aria-hidden="true" /> Booking events
    </button>
  );

  if (notFound) {
    return (
      <div className="py-6">
        {backLink}
        <p className="mt-4 text-accent-text" role="alert">That booking event could not be found.</p>
      </div>
    );
  }
  if (!form) return <RowsSkeleton />;

  const isCancelled = form.cancelled ?? false;
  const show = (k: keyof typeof errors) => (touched ? errors[k] : undefined);
  return (
    <div className="pb-32">
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        {backLink}
        <p className="font-mono text-sm" role="status">
          {isCancelled ? (
            <span className="text-accent-text">Event cancelled</span>
          ) : dirty ? (
            <span className="text-accent-text">Unsaved changes</span>
          ) : (
            <span className="text-muted">All changes saved</span>
          )}
        </p>
      </div>
      <h2 className="text-2xl font-semibold md:text-3xl">{form.id ? 'Edit booking event' : 'New booking event'}</h2>
      {isCancelled && (
        <p className="mt-2 text-sm text-accent-text">This event has been cancelled and cannot be edited or reopened.</p>
      )}

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
            id="f-category"
            label="Event type"
            hint="Where it appears on /events. Kartar Cup and Kartar Club events are free-form (no calendar race)."
          >
            <select
              id="f-category"
              className={inputCls}
              value={form.category}
              onChange={(e) => patch(() => ({ category: e.target.value as EventCategory }))}
            >
              <option value="f1">F1 watch party</option>
              <option value="cup">Kartar Cup event</option>
              <option value="club">Kartar Club event</option>
            </select>
          </Field>
          {form.category === 'f1' && (
          <Field
            id="f-raceid"
            label="Linked race"
            hint="Pulls the race's start time (minus a 30-min arrival buffer) into Date & time. Needed for this race to be marked as hosted on /events."
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
          )}
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
          <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium text-muted">
            <input type="checkbox" checked={form.hosted} onChange={(e) => patch(() => ({ hosted: e.target.checked }))} />
            Show on the public Events page (reads &ldquo;booking opening soon&rdquo; until sales open)
          </label>
        </div>
        <div className="mt-5 max-w-2xl">
          <Field
            id="f-description"
            label="Description (optional)"
            hint="A short blurb shown on the event card, for example what to expect or what to bring."
            error={show('description')}
          >
            <textarea
              id="f-description"
              rows={10}
              maxLength={600}
              className={`${inputCls} py-2`}
              value={form.description}
              aria-invalid={!!show('description')}
              onChange={(e) => patch(() => ({ description: e.target.value }))}
            />
          </Field>
        </div>
        <div className="mt-5 max-w-2xl">
          <Field
            id="f-policy"
            label="Cancellation & refund policy (optional)"
            hint="Shown to guests before they pay and on their ticket. For example: &ldquo;No refunds. Tickets can be transferred to a friend until the day before.&rdquo;"
            error={show('policy')}
          >
            <textarea
              id="f-policy"
              rows={10}
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
          onPick={(p) => patch(() => ({ venueName: p.name, venueCity: p.city, venueMapUrl: p.mapUrl, venuePlaceId: p.place_id }))}
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
          <Button disabled={busy || isCancelled} onClick={() => void save()}>
            <FloppyDisk size={20} weight="regular" aria-hidden="true" /> {busy ? 'Saving...' : 'Save event'}
          </Button>
          {banner && (
            <p role={banner.ok ? 'status' : 'alert'} className={banner.ok ? 'text-ink' : 'text-accent-text'}>
              {banner.msg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** Live read of one booking event: undefined while loading, null when missing or unreadable. */
function useBookingEventById(eventId: string | undefined): BookingEvent | null | undefined {
  const [event, setEvent] = useState<BookingEvent | null | undefined>(undefined);
  useEffect(() => {
    setEvent(undefined);
    if (!eventId) {
      setEvent(null);
      return;
    }
    return watchBookingEvent(eventId, setEvent, () => setEvent(null));
  }, [eventId]);
  return event;
}

function EventMissing({ onBack }: { onBack: () => void }) {
  return (
    <div className="py-6">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink">
        <ArrowLeft size={20} weight="regular" aria-hidden="true" /> Booking events
      </button>
      <p role="alert" className="mt-4 text-accent-text">That booking event could not be found.</p>
    </div>
  );
}

/** Nested route: Attendees roster for an event. */
export function BookingEventAttendees() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const event = useBookingEventById(eventId);

  if (event === undefined) return <RowsSkeleton />;
  if (event === null) return <EventMissing onBack={() => navigate('..', { replace: true })} />;

  return (
    <AttendeeRoster
      event={event}
      onBack={() => navigate('..', { replace: true })}
    />
  );
}

/** Nested route: Cards admin for an event. */
export function BookingEventCards() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const event = useBookingEventById(eventId);

  if (event === undefined) return <RowsSkeleton />;
  if (event === null) return <EventMissing onBack={() => navigate('..', { replace: true })} />;

  return (
    <CardsAdmin
      event={event}
      onBack={() => navigate('..', { replace: true })}
    />
  );
}

function EventListRow({ ev, navigate }: { ev: BookingEvent; navigate: ReturnType<typeof useNavigate> }) {
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [settlingRefunds, setSettlingRefunds] = useState(false);
  const [pendingRefunds, setPendingRefunds] = useState<number>(0);
  const [banner, setBanner] = useState<{ ok: boolean; msg: string } | null>(null);

  // Check for pending refunds on cancelled events
  useEffect(() => {
    if (!ev.cancelled) return;
    const check = async () => {
      try {
        const pending = await pendingEventRefunds(ev.id);
        setPendingRefunds(pending.length);
      } catch {
        setPendingRefunds(0);
      }
    };
    check();
  }, [ev.id, ev.cancelled]);

  const isCancelled = ev.cancelled ?? false;

  async function handleCancel() {
    try {
      setBanner(null);
      await cancelBookingEvent(ev.id, cancelReason);
      setBanner({ ok: true, msg: 'Event cancelled.' });
      setCancelingId(null);
      setCancelReason('');
      setTimeout(() => setBanner(null), 3000);
    } catch (e) {
      setBanner({ ok: false, msg: `Failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
    }
  }

  async function handleSettleRefunds() {
    try {
      setBanner(null);
      setSettlingRefunds(true);
      await settleCancelledEvent(ev.id, (done, total) => {
        setBanner({ ok: true, msg: `Refunding ${done} of ${total} tickets...` });
      });
      setPendingRefunds(0);
      setBanner({ ok: true, msg: 'All refunds completed.' });
      setTimeout(() => setBanner(null), 3000);
    } catch (e) {
      setBanner({ ok: false, msg: `Failed: ${e instanceof Error ? e.message : 'Unknown error'}` });
    } finally {
      setSettlingRefunds(false);
    }
  }

  const hasPendingRefunds = pendingRefunds > 0 && !ev.cancelSettledAt;

  return (
    <>
      <li key={ev.id} className="py-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_10rem_8rem_8rem_6rem_auto] md:items-center md:gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium">{ev.title}</p>
              {isCancelled && (
                <span className="inline-flex min-h-6 items-center rounded-full border border-accent-text px-2.5 text-xs font-medium text-accent-text">
                  Cancelled
                </span>
              )}
            </div>
            <p className="font-mono text-sm text-muted">
              {{ f1: 'F1', cup: 'Kartar Cup', club: 'Kartar Club' }[ev.category ?? 'f1']} · {ev.venue.name}
              {ev.hosted === false && !ev.salesOpen ? ' · hidden' : ''}
            </p>
            {hasPendingRefunds && (
              <p className="mt-1 text-sm text-accent-text">{pendingRefunds} tickets still to refund</p>
            )}
          </div>
          <p className="font-mono text-sm text-muted">{fmtLocal(new Date(ev.dateUtc).getTime())}</p>
          <p className="font-mono text-sm">{ev.bookedCount} / {ev.capacity}</p>
          <p className="text-sm text-muted">{ev.venue.city}</p>
          <span
            className={`inline-flex w-fit min-h-6 items-center rounded-full px-2.5 text-xs font-medium ${
              ev.salesOpen ? 'bg-accent/15 text-accent-text' : 'bg-raised text-muted'
            }`}
          >
            {ev.salesOpen ? 'Open' : 'Closed'}
          </span>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate(`${ev.id}/attendees`, { relative: 'path' })}>
              Attendees
            </Button>
            <Button variant="secondary" onClick={() => navigate(`${ev.id}/cards`, { relative: 'path' })}>
              Cards
            </Button>
            {!isCancelled && (
              <>
                <Button variant="secondary" onClick={() => navigate(`${ev.id}/edit`, { relative: 'path' })}>
                  Edit
                </Button>
                <Button variant="secondary" onClick={() => setCancelingId(ev.id)}>
                  Cancel event
                </Button>
              </>
            )}
            {isCancelled && hasPendingRefunds && (
              <Button variant="secondary" disabled={settlingRefunds} onClick={() => void handleSettleRefunds()}>
                {settlingRefunds ? 'Settling...' : 'Finish refunds'}
              </Button>
            )}
          </div>
        </div>

        {cancelingId === ev.id && (
          <div role="group" aria-label="Cancel event confirmation" className="mt-3 rounded-lg border border-line bg-raised p-4">
            <p className="text-sm">Sales close now, every ticket is cancelled and refunded (sample refunds, no money moves), the event stays in the history.</p>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1rem]">
              <div>
                <label htmlFor={`reason-${ev.id}`} className="block text-xs font-medium text-muted">
                  Reason (optional)
                </label>
                <textarea
                  id={`reason-${ev.id}`}
                  className={inputCls + ' mt-1 min-h-12 resize-none'}
                  maxLength={300}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Why are you cancelling this event?"
                />
                <p className="mt-1 text-xs text-muted">{cancelReason.length} / 300</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => void handleCancel()}>Confirm cancel</Button>
              <Button variant="secondary" onClick={() => { setCancelingId(null); setCancelReason(''); }}>
                Keep event
              </Button>
            </div>
            {banner && (
              <p role={banner.ok ? 'status' : 'alert'} className={`mt-2 text-sm ${banner.ok ? 'text-ink' : 'text-accent-text'}`}>
                {banner.msg}
              </p>
            )}
          </div>
        )}
      </li>
    </>
  );
}

/** Main BookingsAdmin component with nested routes. */
export default function BookingsAdmin() {
  const navigate = useNavigate();
  const atIndex = useMatch({ path: '/host/bookings', end: true });
  const [events, setEvents] = useState<BookingEvent[] | null>(null);

  useEffect(() => {
    const unsub = watchAllBookingEvents(
      (evs) => setEvents([...evs].sort((a, b) => a.dateUtc.localeCompare(b.dateUtc))),
      () => setEvents([]),
    );
    return unsub;
  }, []);

  // Nested views (form, attendees, cards) replace the list instead of rendering under it.
  if (!atIndex) return <Outlet />;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <h2 className="text-2xl font-semibold md:text-3xl">Booking events</h2>
        <Button onClick={() => navigate('new', { relative: 'path' })}>
          <Plus size={20} weight="regular" aria-hidden="true" /> New booking event
        </Button>
      </div>

      {events === null && <RowsSkeleton />}

      {events !== null && events.length === 0 && (
        <p className="mt-6 text-muted">No booking events yet — create one to get started.</p>
      )}

      {events !== null && events.length > 0 && (
        <ul className="mt-2 divide-y divide-line border-y border-line">
          {events.map((ev) => (
            <EventListRow key={ev.id} ev={ev} navigate={navigate} />
          ))}
        </ul>
      )}

    </>
  );
}