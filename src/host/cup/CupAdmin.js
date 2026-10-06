import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import { DEFAULT_POINTS_TABLE, createSeason, deleteDriver, deleteRound, fmtRoundDate, parsePointsTable, recomputeStandings, saveDriver, saveRound, saveSeason, validatePointsTable, watchAllSeasons, watchDrivers, watchRounds, watchStandings, } from '../../lib/cup';
import { Field, Section, iconBtn, inputCls } from '../settings/ui';
import ResultsEditor from './ResultsEditor';
function Banner({ msg }) {
    if (!msg)
        return null;
    return (_jsx("p", { role: msg.ok ? 'status' : 'alert', className: `text-sm ${msg.ok ? 'text-muted' : 'text-accent-text'}`, children: msg.text }));
}
/** Runs an async host action with busy + message handling; nothing is swallowed. */
function useAction() {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);
    async function run(fn, ok) {
        setBusy(true);
        setMsg(null);
        try {
            await fn();
            setMsg({ ok: true, text: ok });
            return true;
        }
        catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
            return false;
        }
        finally {
            setBusy(false);
        }
    }
    return { busy, msg, run, clear: () => setMsg(null) };
}
export { SeasonEditor, ResultsEditor, RoundForm };
export default function CupAdmin() {
    const [seasons, setSeasons] = useState(null);
    const [failed, setFailed] = useState(false);
    const [openId, setOpenId] = useState(null);
    const [name, setName] = useState('');
    const [year, setYear] = useState(String(new Date().getFullYear()));
    const act = useAction();
    useEffect(() => watchAllSeasons((s) => setSeasons([...s].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))), () => setFailed(true)), []);
    if (failed) {
        return (_jsx("p", { className: "py-8 text-accent-text", role: "alert", children: "Could not load Cup seasons. Check your connection and permissions, then reload." }));
    }
    if (!seasons)
        return _jsx(RowsSkeleton, {});
    const open = seasons.find((s) => s.id === openId);
    if (open)
        return _jsx(SeasonEditor, { season: open, onBack: () => setOpenId(null) }, open.id);
    const y = Number(year);
    const canCreate = name.trim().length > 0 && Number.isInteger(y) && y >= 2000 && y <= 2100;
    return (_jsxs("div", { className: "pb-24", children: [_jsx("h2", { className: "mt-6 text-2xl font-semibold md:text-3xl", children: "Karter Cup" }), _jsx("p", { className: "mt-1 max-w-2xl text-muted", children: "Seasons, drivers, rounds and results for the public /cup page. Nothing is public until you publish a season and its rounds." }), _jsxs(Section, { title: "Seasons", children: [seasons.length === 0 ? (_jsx("p", { className: "text-muted", children: "No seasons yet. Create the first one below." })) : (_jsx("ul", { className: "divide-y divide-line border-y border-line", children: seasons.map((s) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => setOpenId(s.id), className: "flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:text-accent-text", children: [_jsx("span", { className: "min-w-0 truncate font-medium", children: s.name }), _jsxs("span", { className: "shrink-0 font-mono text-sm text-muted", children: [s.year, " / ", s.status, " / ", s.published ? 'published' : 'draft'] })] }) }, s.id))) })), _jsxs("form", { className: "mt-6 grid max-w-2xl gap-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end", onSubmit: (e) => {
                            e.preventDefault();
                            if (!canCreate)
                                return;
                            void act
                                .run(() => createSeason({
                                name: name.trim(),
                                year: y,
                                status: 'upcoming',
                                pointsTable: DEFAULT_POINTS_TABLE,
                                fastestLapBonus: 0,
                                published: false,
                            }), 'Season created as a draft.')
                                .then((ok) => ok && setName(''));
                        }, children: [_jsx(Field, { id: "ns-name", label: "New season name", children: _jsx("input", { id: "ns-name", className: inputCls, value: name, maxLength: 80, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { id: "ns-year", label: "Year", children: _jsx("input", { id: "ns-year", className: `${inputCls} font-mono`, inputMode: "numeric", value: year, onChange: (e) => setYear(e.target.value) }) }), _jsxs(Button, { type: "submit", disabled: !canCreate || act.busy, children: [_jsx(Plus, { size: 18, "aria-hidden": "true" }), " Create"] })] }), _jsx("div", { className: "mt-3", children: _jsx(Banner, { msg: act.msg }) })] })] }));
}
function SeasonEditor({ season, onBack }) {
    const [name, setName] = useState(season.name);
    const [year, setYear] = useState(String(season.year));
    const [status, setStatus] = useState(season.status);
    const [table, setTable] = useState(season.pointsTable.join(', '));
    const [bonus, setBonus] = useState(String(season.fastestLapBonus ?? 0));
    const [published, setPublished] = useState(season.published);
    const [touched, setTouched] = useState(false);
    const act = useAction();
    const parsed = parsePointsTable(table);
    const tableErr = validatePointsTable(parsed);
    const bonusN = Number(bonus);
    const bonusErr = Number.isInteger(bonusN) && bonusN >= 0 && bonusN <= 10 ? '' : 'Whole number from 0 to 10.';
    const yearN = Number(year);
    const yearErr = Number.isInteger(yearN) && yearN >= 2000 && yearN <= 2100 ? '' : 'Year 2000 to 2100.';
    const nameErr = name.trim() ? '' : 'Name is required.';
    const invalid = !!(tableErr || bonusErr || yearErr || nameErr);
    function save() {
        setTouched(true);
        if (invalid)
            return;
        void act.run(() => saveSeason({ id: season.id, name: name.trim(), year: yearN, status, pointsTable: parsed, fastestLapBonus: bonusN, published }), published ? 'Saved. This season is public.' : 'Saved as a draft (not public).');
    }
    return (_jsxs("div", { className: "pb-24", children: [_jsxs("button", { type: "button", onClick: onBack, className: "mt-4 inline-flex min-h-11 items-center gap-2 text-muted hover:text-ink", children: [_jsx(ArrowLeft, { size: 20, "aria-hidden": "true" }), " Seasons"] }), _jsx("h2", { className: "mt-2 text-2xl font-semibold md:text-3xl", children: season.name }), _jsxs(Section, { title: "Season settings", intro: "The points table is per season: position 1 first. Editing it recomputes standings.", children: [_jsxs("div", { className: "grid gap-5 md:grid-cols-2", children: [_jsx(Field, { id: "s-name", label: "Name", error: touched ? nameErr : undefined, children: _jsx("input", { id: "s-name", className: inputCls, value: name, maxLength: 80, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { id: "s-year", label: "Year", error: touched ? yearErr : undefined, children: _jsx("input", { id: "s-year", className: `${inputCls} font-mono`, inputMode: "numeric", value: year, onChange: (e) => setYear(e.target.value) }) }), _jsx(Field, { id: "s-status", label: "Status", children: _jsxs("select", { id: "s-status", className: inputCls, value: status, onChange: (e) => setStatus(e.target.value), children: [_jsx("option", { value: "upcoming", children: "Upcoming" }), _jsx("option", { value: "active", children: "Active" }), _jsx("option", { value: "completed", children: "Completed" })] }) }), _jsx(Field, { id: "s-bonus", label: "Fastest-lap bonus points (0 = off)", error: touched ? bonusErr : undefined, children: _jsx("input", { id: "s-bonus", className: `${inputCls} font-mono`, inputMode: "numeric", value: bonus, onChange: (e) => setBonus(e.target.value) }) }), _jsx(Field, { id: "s-table", label: "Points table (1st, 2nd, 3rd, ...)", hint: "Separate with commas or spaces, up to 20 positions. Positions beyond the list score 0.", error: touched ? tableErr : undefined, className: "md:col-span-2", children: _jsx("input", { id: "s-table", className: `${inputCls} font-mono`, value: table, onChange: (e) => setTable(e.target.value) }) }), _jsxs("label", { className: "flex min-h-11 items-center gap-2 text-sm font-medium", children: [_jsx("input", { type: "checkbox", checked: published, onChange: (e) => setPublished(e.target.checked) }), "Published (visible on the public /cup page)"] })] }), _jsxs("div", { className: "mt-5 flex flex-wrap items-center gap-3", children: [_jsx(Button, { onClick: save, disabled: act.busy, children: act.busy ? 'Saving' : 'Save season' }), _jsx(Banner, { msg: act.msg })] })] }), _jsx(DriversPanel, { seasonId: season.id }), _jsx(RoundsPanel, { seasonId: season.id }), _jsx(StandingsPanel, { seasonId: season.id })] }));
}
function useList(sub) {
    const [list, setList] = useState(null);
    const [failed, setFailed] = useState(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => sub(setList, () => setFailed(true)), []);
    return { list, failed };
}
const LoadFail = ({ what }) => (_jsxs("p", { role: "alert", className: "text-accent-text", children: ["Could not load ", what, "."] }));
function DriversPanel({ seasonId }) {
    const { list, failed } = useList((cb, err) => watchDrivers(seasonId, cb, err));
    const [adding, setAdding] = useState(false);
    const act = useAction();
    const drivers = list ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : null;
    return (_jsx(Section, { title: "Drivers", intro: "Removing a driver drops them from standings; use Inactive to keep their results.", children: failed ? (_jsx(LoadFail, { what: "drivers" })) : !drivers ? (_jsx("p", { className: "text-muted", role: "status", children: "Loading drivers." })) : (_jsxs(_Fragment, { children: [drivers.length === 0 && _jsx("p", { className: "mb-4 text-muted", children: "No drivers yet." }), _jsx("ul", { className: "grid gap-4", children: drivers.map((d) => (_jsx(DriverRow, { d: d, seasonId: seasonId }, d.id))) }), adding ? (_jsx(DriverForm, { seasonId: seasonId, initial: { id: '', name: '', active: true }, onDone: () => setAdding(false) })) : (_jsxs(Button, { variant: "secondary", className: "mt-4", onClick: () => setAdding(true), children: [_jsx(Plus, { size: 18, "aria-hidden": "true" }), " Add driver"] })), _jsx("div", { className: "mt-3", children: _jsx(Banner, { msg: act.msg }) })] })) }));
}
function DriverRow({ d, seasonId }) {
    const [edit, setEdit] = useState(false);
    const act = useAction();
    if (edit)
        return _jsx("li", { children: _jsx(DriverForm, { seasonId: seasonId, initial: d, onDone: () => setEdit(false) }) });
    return (_jsxs("li", { className: "flex flex-wrap items-center gap-3 border-b border-line pb-3", children: [_jsxs("span", { className: "min-w-0 flex-1", children: [_jsxs("span", { className: "block truncate font-medium", children: [d.number !== undefined && _jsxs("span", { className: "mr-2 font-mono tabular-nums text-muted", children: ["#", d.number] }), d.name] }), _jsx("span", { className: "block text-sm text-muted", children: [d.team, d.active ? 'Active' : 'Inactive'].filter(Boolean).join(' / ') })] }), _jsx(Button, { variant: "secondary", className: "min-h-11", onClick: () => setEdit(true), children: "Edit" }), _jsx("button", { type: "button", className: iconBtn, "aria-label": `Remove ${d.name}`, disabled: act.busy, onClick: () => {
                    if (window.confirm(`Remove ${d.name}? They will drop out of the standings. Past results keep their slot.`)) {
                        void act.run(() => deleteDriver(seasonId, d), 'Driver removed.');
                    }
                }, children: _jsx(Trash, { size: 18, "aria-hidden": "true" }) }), act.msg && _jsx("div", { className: "w-full", children: _jsx(Banner, { msg: act.msg }) })] }));
}
function DriverForm({ seasonId, initial, onDone }) {
    const [name, setName] = useState(initial.name);
    const [number, setNumber] = useState(initial.number === undefined ? '' : String(initial.number));
    const [team, setTeam] = useState(initial.team ?? '');
    const [active, setActive] = useState(initial.active);
    const [touched, setTouched] = useState(false);
    const act = useAction();
    const numN = Number(number);
    const numErr = number === '' || (Number.isInteger(numN) && numN >= 0 && numN <= 999) ? '' : 'Whole number 0 to 999.';
    const nameErr = name.trim() ? '' : 'Name is required.';
    const id = `drv-${initial.id || 'new'}`;
    function save() {
        setTouched(true);
        if (nameErr || numErr)
            return;
        void act
            .run(() => saveDriver(seasonId, {
            id: initial.id,
            name: name.trim(),
            active,
            ...(number !== '' ? { number: numN } : {}),
            ...(team.trim() ? { team: team.trim() } : {}),
        }), 'Driver saved.')
            .then((ok) => ok && onDone());
    }
    return (_jsxs("div", { className: "mt-4 rounded-lg border border-line p-4", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Field, { id: `${id}-n`, label: "Name", error: touched ? nameErr : undefined, children: _jsx("input", { id: `${id}-n`, className: inputCls, value: name, maxLength: 60, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { id: `${id}-no`, label: "Number (optional)", error: touched ? numErr : undefined, children: _jsx("input", { id: `${id}-no`, className: `${inputCls} font-mono`, inputMode: "numeric", value: number, onChange: (e) => setNumber(e.target.value) }) }), _jsx(Field, { id: `${id}-t`, label: "Team (optional)", children: _jsx("input", { id: `${id}-t`, className: inputCls, value: team, maxLength: 60, onChange: (e) => setTeam(e.target.value) }) }), _jsxs("label", { className: "flex min-h-11 items-center gap-2 self-end text-sm font-medium", children: [_jsx("input", { type: "checkbox", checked: active, onChange: (e) => setActive(e.target.checked) }), " Active"] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3", children: [_jsx(Button, { onClick: save, disabled: act.busy, children: act.busy ? 'Saving' : 'Save driver' }), _jsx(Button, { variant: "ghost", onClick: onDone, disabled: act.busy, children: "Cancel" }), _jsx(Banner, { msg: act.msg })] })] }));
}
function RoundsPanel({ seasonId }) {
    const { list, failed } = useList((cb, err) => watchRounds(seasonId, false, cb, err));
    const { list: drivers } = useList((cb, err) => watchDrivers(seasonId, cb, err));
    const [editing, setEditing] = useState(null); // round id, or '' for new
    const [resultsFor, setResultsFor] = useState(null);
    const act = useAction();
    const rounds = list ? [...list].sort((a, b) => a.order - b.order || a.date.localeCompare(b.date)) : null;
    const nextOrder = rounds && rounds.length ? Math.max(...rounds.map((r) => r.order)) + 1 : 1;
    const forResults = rounds?.find((r) => r.id === resultsFor);
    return (_jsx(Section, { title: "Rounds", intro: "A round counts toward standings only when it is completed, published and has results.", children: failed ? (_jsx(LoadFail, { what: "rounds" })) : !rounds ? (_jsx("p", { className: "text-muted", role: "status", children: "Loading rounds." })) : (_jsxs(_Fragment, { children: [rounds.length === 0 && _jsx("p", { className: "mb-4 text-muted", children: "No rounds yet." }), _jsx("ul", { className: "grid gap-4", children: rounds.map((r) => editing === r.id ? (_jsx("li", { children: _jsx(RoundForm, { seasonId: seasonId, initial: r, onDone: () => setEditing(null) }) }, r.id)) : (_jsxs("li", { className: "flex flex-wrap items-center gap-3 border-b border-line pb-3", children: [_jsxs("span", { className: "min-w-0 flex-1", children: [_jsxs("span", { className: "block truncate font-medium", children: [_jsx("span", { className: "mr-2 font-mono tabular-nums text-muted", children: r.order }), r.name] }), _jsx("span", { className: "block text-sm text-muted", children: [fmtRoundDate(r.date), r.venue, r.status, r.published ? 'published' : 'draft'].filter(Boolean).join(' / ') })] }), _jsx(Button, { variant: "secondary", className: "min-h-11", onClick: () => setResultsFor(r.id), children: "Results" }), _jsx(Button, { variant: "secondary", className: "min-h-11", onClick: () => setEditing(r.id), children: "Edit" }), _jsx("button", { type: "button", className: iconBtn, "aria-label": `Delete ${r.name}`, disabled: act.busy, onClick: () => {
                                    if (window.confirm(`Delete ${r.name} and its results? This cannot be undone.`)) {
                                        if (resultsFor === r.id)
                                            setResultsFor(null);
                                        void act.run(() => deleteRound(seasonId, r), 'Round deleted.');
                                    }
                                }, children: _jsx(Trash, { size: 18, "aria-hidden": "true" }) })] }, r.id))) }), forResults && drivers && (_jsx(ResultsEditor, { seasonId: seasonId, round: forResults, drivers: drivers, onClose: () => setResultsFor(null) }, forResults.id)), editing === '' ? (_jsx(RoundForm, { seasonId: seasonId, initial: { id: '', name: '', date: '', order: nextOrder, status: 'scheduled', published: false }, onDone: () => setEditing(null) })) : (_jsxs(Button, { variant: "secondary", className: "mt-4", onClick: () => setEditing(''), children: [_jsx(Plus, { size: 18, "aria-hidden": "true" }), " Add round"] })), _jsx("div", { className: "mt-3", children: _jsx(Banner, { msg: act.msg }) })] })) }));
}
function RoundForm({ seasonId, initial, onDone }) {
    const [name, setName] = useState(initial.name);
    const [date, setDate] = useState(initial.date);
    const [venue, setVenue] = useState(initial.venue ?? '');
    const [order, setOrder] = useState(String(initial.order));
    const [status, setStatus] = useState(initial.status);
    const [published, setPublished] = useState(initial.published);
    const [touched, setTouched] = useState(false);
    const act = useAction();
    const orderN = Number(order);
    const errs = {
        name: name.trim() ? '' : 'Name is required.',
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? '' : 'Pick a date.',
        order: Number.isInteger(orderN) && orderN >= 0 && orderN <= 1000 ? '' : 'Whole number 0 to 1000.',
    };
    const id = `rnd-${initial.id || 'new'}`;
    function save() {
        setTouched(true);
        if (errs.name || errs.date || errs.order)
            return;
        void act
            .run(() => saveRound(seasonId, {
            id: initial.id,
            name: name.trim(),
            date,
            order: orderN,
            status,
            published,
            ...(venue.trim() ? { venue: venue.trim() } : {}),
        }), 'Round saved.')
            .then((ok) => ok && onDone());
    }
    return (_jsxs("div", { className: "mt-4 rounded-lg border border-line p-4", children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsx(Field, { id: `${id}-n`, label: "Name", error: touched ? errs.name : undefined, children: _jsx("input", { id: `${id}-n`, className: inputCls, value: name, maxLength: 80, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { id: `${id}-d`, label: "Date", error: touched ? errs.date : undefined, children: _jsx("input", { id: `${id}-d`, type: "date", className: `${inputCls} font-mono`, value: date, onChange: (e) => setDate(e.target.value) }) }), _jsx(Field, { id: `${id}-v`, label: "Venue (optional)", children: _jsx("input", { id: `${id}-v`, className: inputCls, value: venue, maxLength: 80, onChange: (e) => setVenue(e.target.value) }) }), _jsx(Field, { id: `${id}-o`, label: "Round number", error: touched ? errs.order : undefined, children: _jsx("input", { id: `${id}-o`, className: `${inputCls} font-mono`, inputMode: "numeric", value: order, onChange: (e) => setOrder(e.target.value) }) }), _jsx(Field, { id: `${id}-s`, label: "Status", children: _jsxs("select", { id: `${id}-s`, className: inputCls, value: status, onChange: (e) => setStatus(e.target.value), children: [_jsx("option", { value: "scheduled", children: "Scheduled" }), _jsx("option", { value: "completed", children: "Completed" })] }) }), _jsxs("label", { className: "flex min-h-11 items-center gap-2 self-end text-sm font-medium", children: [_jsx("input", { type: "checkbox", checked: published, onChange: (e) => setPublished(e.target.checked) }), " Published"] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3", children: [_jsx(Button, { onClick: save, disabled: act.busy, children: act.busy ? 'Saving' : 'Save round' }), _jsx(Button, { variant: "ghost", onClick: onDone, disabled: act.busy, children: "Cancel" }), _jsx(Banner, { msg: act.msg })] })] }));
}
function StandingsPanel({ seasonId }) {
    const [info, setInfo] = useState(undefined);
    const [failed, setFailed] = useState(false);
    const act = useAction();
    useEffect(() => watchStandings(seasonId, (s) => setInfo(s), () => setFailed(true)), [seasonId]);
    const when = info?.updatedAt?.toDate().toLocaleString();
    return (_jsxs(Section, { title: "Standings", intro: "Precomputed here and stored for the public page. They refresh automatically on every save above.", children: [failed ? (_jsx(LoadFail, { what: "standings" })) : (_jsx("p", { className: "text-muted", role: "status", children: info === undefined
                    ? 'Loading.'
                    : info === null
                        ? 'Not computed yet.'
                        : `${info.roundsCounted} round${info.roundsCounted === 1 ? '' : 's'} counted${when ? `, updated ${when}` : ''}.` })), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3", children: [_jsx(Button, { variant: "secondary", disabled: act.busy, onClick: () => void act.run(() => recomputeStandings(seasonId), 'Standings recomputed.'), children: act.busy ? 'Recomputing' : 'Recompute standings' }), _jsx(Banner, { msg: act.msg })] })] }));
}
