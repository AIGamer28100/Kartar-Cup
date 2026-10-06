import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Lightning, LockSimple, LockSimpleOpen, Plus, ArrowCounterClockwise } from '@phosphor-icons/react';
import Button from '../../components/Button';
import Skeleton from '../../components/Skeleton';
import { extendCloses, getActiveEventId, setOverride, watchActiveEventId, watchEventConfig } from '../../lib/db';
import { useEventStatus } from '../../lib/eventStatus';
import { Section, TimeTriple } from './ui';
export default function LiveControls() {
    const [activeId, setActiveId] = useState(undefined);
    const [cfg, setCfg] = useState(undefined);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const status = useEventStatus(cfg);
    useEffect(() => watchActiveEventId(setActiveId, (e) => setErr(e.message)), []);
    useEffect(() => {
        if (!activeId) {
            setCfg(activeId === null ? null : undefined);
            return;
        }
        return watchEventConfig(activeId, setCfg, (e) => setErr(e.message));
    }, [activeId]);
    async function run(fn) {
        setBusy(true);
        setErr(null);
        try {
            const id = activeId ?? (await getActiveEventId());
            if (!id)
                throw new Error('No live event yet. Set one as live first.');
            await fn(id);
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'The pit wall did not answer. Try again.');
        }
        finally {
            setBusy(false);
        }
    }
    const label = { scheduled: 'Scheduled', open: 'Open', closed: 'Closed', scored: 'Scored' };
    return (_jsxs(Section, { title: "Live controls", intro: "These act on the live event immediately, no save needed.", children: [cfg === undefined && activeId !== null && _jsx(Skeleton, { className: "h-24" }), (activeId === null || cfg === null) && _jsx("p", { className: "text-muted", children: "No live event yet. Save an event and set it live below." }), cfg && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-6 md:grid-cols-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-muted", children: "Live event" }), _jsx("p", { className: "mt-1 text-lg", children: cfg.name }), _jsxs("p", { className: "mt-1 text-sm text-muted", children: ["Status ", _jsx("span", { "data-testid": "live-status", className: "font-mono text-ink", children: status ? label[status] : '--' }), cfg.override !== 'none' && (_jsxs("span", { className: "font-mono text-ink", children: [" (override: ", cfg.override, ")"] }))] })] }), _jsx(TimeTriple, { label: "Quiz opens", ms: cfg.opensAt.toMillis(), testId: "live-opens" }), _jsx(TimeTriple, { label: "Quiz closes", ms: cfg.closesAt.toMillis(), testId: "live-closes" })] }), _jsxs("div", { className: "mt-6 flex flex-wrap gap-3", children: [_jsxs(Button, { variant: "secondary", disabled: busy, onClick: () => run((id) => setOverride(id, 'open')), children: [_jsx(LockSimpleOpen, { size: 20, weight: "regular" }), " Open now"] }), _jsxs(Button, { variant: "secondary", disabled: busy, onClick: () => run((id) => setOverride(id, 'closed')), children: [_jsx(LockSimple, { size: 20, weight: "regular" }), " Close now"] }), [5, 10, 15].map((m) => (_jsxs(Button, { variant: "secondary", disabled: busy, onClick: () => run((id) => extendCloses(id, m)), children: [_jsx(Plus, { size: 20, weight: "regular" }), " Extend closing +", m, " min"] }, m))), _jsxs(Button, { variant: "ghost", disabled: busy, onClick: () => run((id) => setOverride(id, 'none')), children: [_jsx(ArrowCounterClockwise, { size: 20, weight: "regular" }), " Clear override"] })] })] })), err && (_jsxs("p", { role: "alert", className: "mt-4 text-accent-text", children: [_jsx(Lightning, { size: 16, weight: "regular", className: "mr-1 inline" }), err] }))] }));
}
