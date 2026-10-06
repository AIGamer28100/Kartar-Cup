import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FloppyDisk, Plus } from '@phosphor-icons/react';
import { useNavigate, useParams, Outlet } from 'react-router';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import { deleteField } from 'firebase/firestore';
import { createBookingEvent, updateBookingEvent, watchAllBookingEvents, watchBookingEvent } from '../../lib/bookings';
import { useAuth } from '../../lib/auth';
import { permissionHint } from '../../lib/permissionHint';
import { fmtLocal } from '../settings/time';
import { Field, Section, inputCls } from '../settings/ui';
import { useSchedule } from '../../lib/useSchedule';
import { DiscountsEditor, TiersEditor } from './Editors';
import VenueSearch from './VenueSearch';
import AttendeeRoster from './AttendeeRoster';
import CardsAdmin from './CardsAdmin';
import { formToEvent, raceDefaultDateUtc, upcomingRaceOptions, validate, } from './model';
const snap = (f) => JSON.stringify(f);
/** Nested route: Edit or create booking event form. */
export function BookingEventForm() {
    const { access } = useAuth();
    const { eventId } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(eventId);
    const [form, setForm] = useState(null);
    const [saved, setSaved] = useState('');
    const [busy, setBusy] = useState(false);
    const [banner, setBanner] = useState(null);
    const [touched, setTouched] = useState(false);
    const { schedule } = useSchedule(2026);
    const { schedule: schedule27 } = useSchedule(2027);
    const raceOptions = useMemo(() => upcomingRaceOptions(new Date(), 5, form?.raceId || undefined), [form?.raceId]);
    useEffect(() => {
        if (isEditing && eventId) {
            // TODO: fetch single event for editing
            // For now, we'll need to load from the parent's events list
            // This is a limitation - we'll handle it by passing events from parent
        }
    }, [eventId, isEditing]);
    const patch = useCallback((fn) => {
        setBanner(null);
        setForm((f) => (f ? { ...f, ...fn(f) } : f));
    }, []);
    const errors = useMemo(() => (form ? validate(form) : {}), [form]);
    const dirty = form ? snap(form) !== saved : false;
    function closeForm() {
        navigate('../..', { replace: true });
    }
    async function save() {
        setTouched(true);
        if (!form)
            return;
        if (Object.keys(errors).length > 0) {
            setBanner({ ok: false, msg: 'Fix the highlighted fields before saving.' });
            return;
        }
        setBusy(true);
        setBanner(null);
        try {
            const payload = formToEvent(form);
            if (form.id)
                await updateBookingEvent(form.id, payload.raceId ? payload : { ...payload, raceId: deleteField() });
            else
                await createBookingEvent(payload);
            setSaved(snap(form));
            setBanner({ ok: true, msg: 'Booking event saved.' });
            navigate('../..', { replace: true });
        }
        catch (e) {
            setBanner({ ok: false, msg: permissionHint(e, 'bookings', access, 'save this booking event') });
        }
        finally {
            setBusy(false);
        }
    }
    const backLink = (_jsxs("button", { type: "button", onClick: closeForm, className: "inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink", children: [_jsx(ArrowLeft, { size: 20, weight: "regular" }), " Booking events"] }));
    if (!form)
        return null;
    const show = (k) => (touched ? errors[k] : undefined);
    return (_jsxs("div", { className: "pb-32", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 py-4", children: [backLink, _jsx("p", { className: "font-mono text-sm", role: "status", children: dirty ? _jsx("span", { className: "text-accent-text", children: "Unsaved changes" }) : _jsx("span", { className: "text-muted", children: "All changes saved" }) })] }), _jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: form.id ? 'Edit booking event' : 'New booking event' }), _jsxs(Section, { title: "Details", children: [_jsxs("div", { className: "grid gap-5 md:grid-cols-2 xl:grid-cols-3", children: [_jsx(Field, { id: "f-title", label: "Title", error: show('title'), children: _jsx("input", { id: "f-title", className: inputCls, value: form.title, maxLength: 120, "aria-invalid": !!show('title'), onChange: (e) => patch(() => ({ title: e.target.value })) }) }), _jsx(Field, { id: "f-category", label: "Event type", hint: "Where it appears on /events. Kartar Cup and Kartar Club events are free-form (no calendar race).", children: _jsxs("select", { id: "f-category", className: inputCls, value: form.category, onChange: (e) => patch(() => ({ category: e.target.value })), children: [_jsx("option", { value: "f1", children: "F1 watch party" }), _jsx("option", { value: "cup", children: "Kartar Cup event" }), _jsx("option", { value: "club", children: "Kartar Club event" })] }) }), form.category === 'f1' && (_jsx(Field, { id: "f-raceid", label: "Linked race", hint: "Pulls the race's start time (minus a 30-min arrival buffer) into Date & time. Needed for this race to be marked as hosted on /events.", children: _jsxs("select", { id: "f-raceid", className: inputCls, value: form.raceId, onChange: (e) => {
                                        const id = e.target.value;
                                        const race = raceOptions.find((r) => r.id === id);
                                        patch(() => ({ raceId: id, ...(race ? { dateUtc: raceDefaultDateUtc(race, race.season === 2027 ? schedule27 : schedule) } : {}) }));
                                    }, children: [_jsx("option", { value: "", children: "Not linked to a calendar race" }), raceOptions.map((r) => (_jsxs("option", { value: r.id, children: ["R", r.round, " ", r.name, " (", r.raceDate, ")"] }, r.id)))] }) })), _jsx(Field, { id: "f-date", label: "Date & time", error: show('dateUtc'), children: _jsx("input", { id: "f-date", type: "datetime-local", className: `${inputCls} font-mono`, value: form.dateUtc, "aria-invalid": !!show('dateUtc'), onChange: (e) => patch(() => ({ dateUtc: e.target.value })) }) }), _jsx(Field, { id: "f-capacity", label: "Capacity", error: show('capacity'), children: _jsx("input", { id: "f-capacity", type: "number", inputMode: "numeric", min: 1, className: `${inputCls} font-mono`, value: form.capacity, "aria-invalid": !!show('capacity'), onChange: (e) => patch(() => ({ capacity: e.target.value })) }) }), _jsxs("label", { className: "flex min-h-11 items-center gap-2 self-end text-sm font-medium text-muted", children: [_jsx("input", { type: "checkbox", checked: form.salesOpen, onChange: (e) => patch(() => ({ salesOpen: e.target.checked })) }), "Open for sales"] }), _jsxs("label", { className: "flex min-h-11 items-center gap-2 self-end text-sm font-medium text-muted", children: [_jsx("input", { type: "checkbox", checked: form.hosted, onChange: (e) => patch(() => ({ hosted: e.target.checked })) }), "Show on the public Events page (reads \u201Cbooking opening soon\u201D until sales open)"] })] }), _jsx("div", { className: "mt-5 max-w-2xl", children: _jsx(Field, { id: "f-description", label: "Description (optional)", hint: "A short blurb shown on the event card, for example what to expect or what to bring.", error: show('description'), children: _jsx("textarea", { id: "f-description", rows: 10, maxLength: 3000, className: `${inputCls} py-2`, value: form.description, "aria-invalid": !!show('description'), onChange: (e) => patch(() => ({ description: e.target.value })) }) }) }), _jsx("div", { className: "mt-5 max-w-2xl", children: _jsx(Field, { id: "f-policy", label: "Cancellation & refund policy (optional)", hint: "Shown to guests before they pay and on their ticket. For example: \u201CNo refunds. Tickets can be transferred to a friend until the day before.\u201D", error: show('policy'), children: _jsx("textarea", { id: "f-policy", rows: 10, maxLength: 3000, className: `${inputCls} py-2`, value: form.policy, "aria-invalid": !!show('policy'), onChange: (e) => patch(() => ({ policy: e.target.value })) }) }) })] }), _jsxs(Section, { title: "Venue", children: [_jsx(VenueSearch, { onPick: (p) => patch(() => ({ venueName: p.name, venueCity: p.city, venueMapUrl: p.mapUrl, venuePlaceId: p.place_id })) }), _jsxs("div", { className: "grid gap-5 md:grid-cols-2 xl:grid-cols-4", children: [_jsx(Field, { id: "f-venue-name", label: "Name", error: show('venueName'), children: _jsx("input", { id: "f-venue-name", className: inputCls, value: form.venueName, "aria-invalid": !!show('venueName'), onChange: (e) => patch(() => ({ venueName: e.target.value })) }) }), _jsx(Field, { id: "f-venue-city", label: "City", error: show('venueCity'), children: _jsx("input", { id: "f-venue-city", className: inputCls, value: form.venueCity, "aria-invalid": !!show('venueCity'), onChange: (e) => patch(() => ({ venueCity: e.target.value })) }) }), _jsx(Field, { id: "f-venue-map", label: "Map link (optional)", hint: "Optional. Paste a Google Maps link for an exact pin; leave blank and the map is found from the venue name and city.", children: _jsx("input", { id: "f-venue-map", type: "url", className: inputCls, value: form.venueMapUrl, onChange: (e) => patch(() => ({ venueMapUrl: e.target.value })) }) }), _jsx(Field, { id: "f-venue-cap", label: "Default capacity (optional)", children: _jsx("input", { id: "f-venue-cap", type: "number", inputMode: "numeric", min: 0, className: `${inputCls} font-mono`, value: form.venueCapacityDefault, onChange: (e) => patch(() => ({ venueCapacityDefault: e.target.value })) }) })] })] }), _jsx(TiersEditor, { form: form, errors: errors, patch: patch }), _jsx(DiscountsEditor, { form: form, errors: errors, patch: patch }), _jsx("div", { className: "fixed inset-x-0 bottom-0 z-10 border-t border-line bg-base/95 px-6 py-3 backdrop-blur md:px-10 lg:px-16", children: _jsxs("div", { className: "mx-auto flex max-w-[87.5rem] flex-wrap items-center gap-3", children: [_jsxs(Button, { disabled: busy, onClick: () => void save(), children: [_jsx(FloppyDisk, { size: 20, weight: "regular" }), " ", busy ? 'Saving...' : 'Save event'] }), banner && (_jsx("p", { role: banner.ok ? 'status' : 'alert', className: banner.ok ? 'text-ink' : 'text-accent-text', children: banner.msg }))] }) })] }));
}
/** Nested route: Attendees roster for an event. */
export function BookingEventAttendees() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    useEffect(() => {
        if (!eventId)
            return;
        return watchBookingEvent(eventId, setEvent, () => setEvent(null));
    }, [eventId]);
    if (!event)
        return null;
    return (_jsx(AttendeeRoster, { event: event, onBack: () => navigate('../..', { replace: true }) }));
}
/** Nested route: Cards admin for an event. */
export function BookingEventCards() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [event, setEvent] = useState(null);
    useEffect(() => {
        if (!eventId)
            return;
        return watchBookingEvent(eventId, setEvent, () => setEvent(null));
    }, [eventId]);
    if (!event)
        return null;
    return (_jsx(CardsAdmin, { event: event, onBack: () => navigate('../..', { replace: true }) }));
}
/** Main BookingsAdmin component with nested routes. */
export default function BookingsAdmin() {
    const navigate = useNavigate();
    const [events, setEvents] = useState(null);
    useEffect(() => {
        const unsub = watchAllBookingEvents((evs) => setEvents([...evs].sort((a, b) => a.dateUtc.localeCompare(b.dateUtc))), () => setEvents([]));
        return unsub;
    }, []);
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 py-4", children: [_jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: "Booking events" }), _jsxs(Button, { onClick: () => navigate('new', { relative: 'path' }), children: [_jsx(Plus, { size: 20, weight: "regular" }), " New booking event"] })] }), events === null && _jsx(RowsSkeleton, {}), events !== null && events.length === 0 && (_jsx("p", { className: "mt-6 text-muted", children: "No booking events yet \u2014 create one to get started." })), events !== null && events.length > 0 && (_jsx("ul", { className: "mt-2 divide-y divide-line border-y border-line", children: events.map((ev) => (_jsxs("li", { className: "grid grid-cols-1 gap-2 py-4 md:grid-cols-[1fr_10rem_8rem_8rem_6rem_auto] md:items-center md:gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium", children: ev.title }), _jsxs("p", { className: "font-mono text-sm text-muted", children: [{ f1: 'F1', cup: 'Kartar Cup', club: 'Kartar Club' }[ev.category ?? 'f1'], " \u00B7 ", ev.venue.name, ev.hosted === false && !ev.salesOpen ? ' · hidden' : ''] })] }), _jsx("p", { className: "font-mono text-sm text-muted", children: fmtLocal(new Date(ev.dateUtc).getTime()) }), _jsxs("p", { className: "font-mono text-sm", children: [ev.bookedCount, " / ", ev.capacity] }), _jsx("p", { className: "text-sm text-muted", children: ev.venue.city }), _jsx("span", { className: `inline-flex w-fit min-h-6 items-center rounded-full px-2.5 text-xs font-medium ${ev.salesOpen ? 'bg-accent/15 text-accent-text' : 'bg-raised text-muted'}`, children: ev.salesOpen ? 'Open' : 'Closed' }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => navigate(`${ev.id}/attendees`, { relative: 'path' }), children: "Attendees" }), _jsx(Button, { variant: "secondary", onClick: () => navigate(`${ev.id}/cards`, { relative: 'path' }), children: "Cards" }), _jsx(Button, { variant: "secondary", onClick: () => navigate(`${ev.id}/edit`, { relative: 'path' }), children: "Edit" })] })] }, ev.id))) })), _jsx(Outlet, {})] }));
}
