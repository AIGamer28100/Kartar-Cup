import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowSquareOut, FloppyDisk, Broadcast } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { Link } from 'react-router';
import FailurePage from '../../components/FailurePage';
import Skeleton, { Busy } from '../../components/Skeleton';
import { useTimedOut } from '../../lib/useTimedOut';
import { ALL_RACES, nextRace, getRace } from '../../config/calendar';
import { getActiveEventId, saveEventConfig, setActiveEvent, watchEventConfig } from '../../lib/db';
import { QuestionsEditor } from './Editors';
import { GridView, RefreshGridButton, TeamsView, useGridRefresh } from './GridTeamsView';
import LiveControls from './LiveControls';
import { compute, configToForm, customForm, formToConfig, raceToForm, validate, } from './model';
import { Field, Section, TimeTriple, inputCls, linkBtn } from './ui';
import { TabList, TabPanel } from './Tabs';
const TABS = [
    { id: 'details', label: 'Details' },
    { id: 'grid', label: 'Grid' },
    { id: 'teams', label: 'Teams' },
    { id: 'questions', label: 'Questions' },
];
import { fromLocalInput } from './time';
/** One-shot read of an event config via the existing watcher (no getDoc helper in db.ts). */
function readEvent(id) {
    return new Promise((resolve, reject) => {
        let unsub = null;
        let done = false;
        unsub = watchEventConfig(id, (c) => {
            done = true;
            unsub?.();
            resolve(c);
        }, reject);
        if (done)
            unsub();
    });
}
const snap = (f) => JSON.stringify(f);
const CUSTOM = 'custom';
export default function SettingsPage() {
    const [form, setForm] = useState(null);
    const [saved, setSaved] = useState('');
    const [loadErr, setLoadErr] = useState(null);
    const [busy, setBusy] = useState(null);
    const [banner, setBanner] = useState(null);
    const [touched, setTouched] = useState(false);
    const [pickErr, setPickErr] = useState(null);
    const [tab, setTab] = useState(TABS[0].id);
    const init = useRef(false);
    const stuck = useTimedOut(!form && !loadErr);
    useEffect(() => {
        if (init.current)
            return;
        init.current = true;
        (async () => {
            try {
                const activeId = await getActiveEventId();
                const existing = activeId ? await readEvent(activeId) : null;
                const f = existing
                    ? configToForm(existing)
                    : await raceToForm(nextRace(new Date(), ALL_RACES) ?? ALL_RACES[0]);
                setForm(f);
                setSaved(existing ? snap(f) : '');
            }
            catch (e) {
                setLoadErr(e instanceof Error ? e.message : 'Could not load the event.');
            }
        })();
    }, []);
    const patch = useCallback((fn) => {
        setBanner(null);
        setForm((f) => (f ? { ...f, ...fn(f) } : f));
    }, []);
    const errors = useMemo(() => (form ? validate(form) : {}), [form]);
    const dirty = form ? snap(form) !== saved : false;
    const comp = useMemo(() => (form ? compute(form) : null), [form]);
    const formRace = form ? (getRace(form.raceId) ?? null) : null;
    const gridRefresh = useGridRefresh(form, patch, formRace);
    async function pickRace(id) {
        setPickErr(null);
        setBanner(null);
        try {
            if (id === CUSTOM) {
                setForm(await customForm());
                return;
            }
            const race = getRace(id);
            if (!race)
                return;
            const existing = await readEvent(race.id);
            setForm(existing ? configToForm(existing) : await raceToForm(race));
            if (existing)
                setSaved(snap(configToForm(existing)));
        }
        catch (e) {
            setPickErr(e instanceof Error ? e.message : 'Could not load that race.');
        }
    }
    async function save(makeLive) {
        setTouched(true);
        if (!form)
            return;
        if (Object.keys(errors).length > 0) {
            setBanner({ ok: false, msg: 'Fix the highlighted fields before saving.' });
            return;
        }
        setBusy(makeLive ? 'live' : 'save');
        setBanner(null);
        try {
            await saveEventConfig(formToConfig(form));
            setSaved(snap(form));
            if (makeLive)
                await setActiveEvent(form.id);
            setBanner({ ok: true, msg: makeLive ? 'Saved. This is now the live event.' : 'Event saved.' });
        }
        catch (e) {
            setBanner({ ok: false, msg: e instanceof Error ? e.message : 'Save failed. Try again.' });
        }
        finally {
            setBusy(null);
        }
    }
    const backLink = (_jsxs(Link, { to: "/host", className: "inline-flex min-h-11 items-center gap-2 text-muted transition hover:text-ink", children: [_jsx(ArrowLeft, { size: 20, weight: "regular" }), " Race control"] }));
    if (loadErr || stuck)
        return _jsx(FailurePage, { error: loadErr ?? 'The event did not load in time.' });
    if (!form || !comp)
        return (_jsxs(Busy, { className: "py-8", children: [backLink, _jsxs("div", { className: "mt-6 space-y-4", children: [_jsx(Skeleton, { className: "h-16" }), _jsx(Skeleton, { className: "h-16" }), _jsx(Skeleton, { className: "h-40" })] })] }));
    const show = (k) => (touched || form[k] !== '' ? errors[k] : undefined);
    const race = getRace(form.raceId);
    const pickerValue = form.raceId === CUSTOM ? CUSTOM : form.raceId;
    const seasons = [2026, 2027];
    const whatsappErr = errors.whatsapp;
    const busyAny = busy !== null;
    return (_jsxs("div", { className: "pb-32", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-3 py-4", children: [backLink, _jsx("p", { className: "font-mono text-sm", "data-testid": "dirty-indicator", role: "status", children: dirty ? _jsx("span", { className: "text-accent-text", children: "Unsaved changes" }) : _jsx("span", { className: "text-muted", children: "All changes saved" }) })] }), _jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: "Event settings" }), _jsx(TabList, { tabs: TABS, active: tab, onChange: setTab, label: "Settings sections" }), _jsxs(TabPanel, { id: "details", active: tab === 'details', children: [_jsx(LiveControls, {}), _jsxs(Section, { title: "Race", intro: "Pick a race to pre-fill the form, or start a custom event.", children: [_jsx(Field, { id: "race-picker", label: "Race", error: pickErr ?? undefined, className: "max-w-2xl", children: _jsxs("select", { id: "race-picker", className: inputCls, value: pickerValue, onChange: (e) => void pickRace(e.target.value), children: [_jsx("option", { value: CUSTOM, children: "Custom event" }), seasons.map((s) => (_jsx("optgroup", { label: `${s} season`, children: ALL_RACES.filter((r) => r.season === s).map((r) => (_jsxs("option", { value: r.id, disabled: r.status === 'cancelled-by-host', children: ["R", r.round, " ", r.name, " (", r.weekendStart, " to ", r.weekendEnd, ")", r.status === 'cancelled-by-host' ? ' - cancelled' : ''] }, r.id))) }, s)))] }) }), _jsx("p", { className: "mt-2 text-sm text-muted", children: "Races cancelled by the host are listed but cannot be chosen." }), race && (_jsxs("p", { className: "mt-3 font-mono text-sm text-muted", children: [race.season, " round ", race.round, " / race day ", race.raceDate] }))] }), _jsx(Section, { title: "Details", children: _jsxs("div", { className: "grid gap-5 md:grid-cols-2 xl:grid-cols-3", children: [_jsx(Field, { id: "f-name", label: "Event name", error: show('name'), children: _jsx("input", { id: "f-name", className: inputCls, value: form.name, maxLength: 80, "aria-invalid": !!show('name'), onChange: (e) => patch(() => ({ name: e.target.value })) }) }), _jsx(Field, { id: "f-sub", label: "Subtitle", error: show('subtitle'), children: _jsx("input", { id: "f-sub", className: inputCls, value: form.subtitle, maxLength: 120, onChange: (e) => patch(() => ({ subtitle: e.target.value })) }) }), _jsx(Field, { id: "f-circuit", label: "Circuit", error: show('circuit'), children: _jsx("input", { id: "f-circuit", className: inputCls, value: form.circuit, maxLength: 80, onChange: (e) => patch(() => ({ circuit: e.target.value })) }) })] }) }), _jsxs(Section, { title: "Timing", intro: "Times are entered in your local time. Every instant is also shown in IST and UTC.", children: [_jsxs("div", { className: "grid gap-6 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-4", children: [_jsx(Field, { id: "f-start", label: "Race start (your local time)", error: errors.start, children: _jsx("input", { id: "f-start", type: "datetime-local", className: `${inputCls} font-mono`, value: form.start, "aria-invalid": !!errors.start, onChange: (e) => patch(() => ({ start: e.target.value })) }) }), _jsx(TimeTriple, { label: "Race start", ms: comp.startMs, testId: "start-readout" })] }), _jsx("div", { children: _jsx(Field, { id: "f-duration", label: "Normal race duration (minutes)", error: errors.duration, children: _jsx("input", { id: "f-duration", type: "number", inputMode: "numeric", min: 10, max: 600, className: `${inputCls} font-mono`, value: form.duration, "aria-invalid": !!errors.duration, onChange: (e) => patch(() => ({ duration: e.target.value })) }) }) })] }), _jsxs("div", { className: "mt-8 grid gap-6 md:grid-cols-2", children: [_jsx(TimeTriple, { label: "Quiz opens (at lights-out)", ms: comp.autoOpensMs, testId: "auto-opens" }), _jsx(TimeTriple, { label: "Quiz closes (90% of normal race)", ms: comp.autoClosesMs, testId: "auto-closes" })] }), _jsxs("div", { className: "mt-8 grid gap-6 md:grid-cols-2", children: [_jsxs("div", { className: "space-y-3", children: [_jsx(Field, { id: "f-opens", label: "Opens at override (optional)", hint: "Empty uses the automatic time.", children: _jsx("input", { id: "f-opens", type: "datetime-local", className: `${inputCls} font-mono`, value: form.opensOverride, onChange: (e) => patch(() => ({ opensOverride: e.target.value })) }) }), !Number.isNaN(fromLocalInput(form.opensOverride)) && _jsx(TimeTriple, { label: "Opens at (effective)", ms: comp.opensMs })] }), _jsxs("div", { className: "space-y-3", children: [_jsx(Field, { id: "f-closes", label: "Closes at override (optional)", hint: "Empty uses the automatic time.", children: _jsx("input", { id: "f-closes", type: "datetime-local", className: `${inputCls} font-mono`, value: form.closesOverride, onChange: (e) => patch(() => ({ closesOverride: e.target.value })) }) }), !Number.isNaN(fromLocalInput(form.closesOverride)) && _jsx(TimeTriple, { label: "Closes at (effective)", ms: comp.closesMs })] })] }), errors.window && (_jsx("p", { role: "alert", className: "mt-4 text-sm text-accent-text", children: errors.window }))] }), _jsx(Section, { title: "WhatsApp community", intro: "Shown to guests as a join button. Leave empty to hide it.", children: _jsxs("div", { className: "flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-end", children: [_jsx(Field, { id: "f-wa", label: "Community link", error: whatsappErr, className: "flex-1", children: _jsx("input", { id: "f-wa", type: "url", inputMode: "url", autoComplete: "off", spellCheck: false, placeholder: "https://chat.whatsapp.com/...", className: `${inputCls} font-mono`, value: form.whatsapp, "aria-invalid": !!whatsappErr, "aria-describedby": whatsappErr ? 'f-wa-err' : undefined, onChange: (e) => patch(() => ({ whatsapp: e.target.value.trim() })) }) }), form.whatsapp && !whatsappErr ? (_jsxs("a", { href: form.whatsapp, target: "_blank", rel: "noopener noreferrer", className: linkBtn, children: [_jsx(ArrowSquareOut, { size: 20, weight: "regular" }), " Test link"] })) : (_jsxs("span", { "aria-disabled": "true", className: `${linkBtn} pointer-events-none opacity-50`, children: [_jsx(ArrowSquareOut, { size: 20, weight: "regular" }), " Test link"] }))] }) }), _jsxs("p", { className: "mt-2 font-mono text-sm text-muted", children: [form.drivers.length, " drivers / ", form.teams.length, " teams / ", form.questions.length, " questions"] })] }), _jsxs(TabPanel, { id: "grid", active: tab === 'grid', children: [_jsx("div", { className: "flex justify-end", children: _jsx(RefreshGridButton, { busy: gridRefresh.busy, onRefresh: () => void gridRefresh.refresh(), disabled: !race }) }), _jsx(GridView, { form: form })] }), _jsxs(TabPanel, { id: "teams", active: tab === 'teams', children: [_jsx("div", { className: "flex justify-end", children: _jsx(RefreshGridButton, { busy: gridRefresh.busy, onRefresh: () => void gridRefresh.refresh(), disabled: !race }) }), _jsx(TeamsView, { form: form })] }), _jsx(TabPanel, { id: "questions", active: tab === 'questions', children: _jsx(QuestionsEditor, { form: form, errors: errors, patch: patch }) }), _jsx("div", { className: "fixed inset-x-0 bottom-0 z-10 border-t border-line bg-base/95 px-6 py-3 backdrop-blur md:px-10 lg:px-16", children: _jsxs("div", { className: "mx-auto flex max-w-[87.5rem] flex-wrap items-center gap-3", children: [_jsxs(Button, { disabled: busyAny, onClick: () => void save(false), children: [_jsx(FloppyDisk, { size: 20, weight: "regular" }), " ", busy === 'save' ? 'Saving...' : 'Save event'] }), _jsxs(Button, { variant: "secondary", disabled: busyAny, onClick: () => void save(true), children: [_jsx(Broadcast, { size: 20, weight: "regular" }), " ", busy === 'live' ? 'Going live...' : 'Set as live event'] }), banner && (_jsx("p", { role: banner.ok ? 'status' : 'alert', "data-testid": "save-banner", className: banner.ok ? 'text-ink' : 'text-accent-text', children: banner.msg }))] }) })] }));
}
