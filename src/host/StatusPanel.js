import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Flag, LockSimple, LockSimpleOpen } from '@phosphor-icons/react';
import Button from '../components/Button';
import StatusDot from '../components/StatusDot';
import { LIGHTS_OUT_UTC } from '../config/event';
import { initEvent, setEventStatus, setLightsOut } from '../lib/db';
function toLocalInput(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export default function StatusPanel({ event, count }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const [lights, setLights] = useState('');
    const lightsMs = event?.lightsOutUtc.toMillis();
    useEffect(() => {
        if (lightsMs !== undefined)
            setLights(toLocalInput(new Date(lightsMs)));
    }, [lightsMs]);
    async function run(fn) {
        setBusy(true);
        setErr(null);
        try {
            await fn();
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'The pit wall did not answer. Try again.');
        }
        finally {
            setBusy(false);
        }
    }
    const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
    return (_jsxs("section", { "aria-label": "Race control", className: "border-b border-line py-8", children: [_jsxs("div", { className: "flex flex-wrap items-end justify-between gap-6", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm uppercase tracking-widest text-muted", children: "Grid entries" }), _jsx("p", { className: "font-mono text-5xl tabular-nums leading-none md:text-6xl", "aria-live": "polite", children: count })] }), event ? (_jsxs("div", { className: "flex flex-col items-start gap-3 md:items-end", children: [_jsxs("p", { className: "flex items-center gap-3 text-2xl", children: [_jsx(StatusDot, { status: event.status }), _jsx("span", { className: "uppercase tracking-widest", children: event.status })] }), event.status === 'open' ? (_jsxs(Button, { disabled: busy, onClick: () => run(() => setEventStatus('locked')), children: [_jsx(LockSimple, { size: 20, weight: "regular" }), " Lock the pit lane"] })) : (_jsxs(Button, { variant: "secondary", disabled: busy, onClick: () => run(() => setEventStatus('open')), children: [_jsx(LockSimpleOpen, { size: 20, weight: "regular" }), " Reopen entries"] }))] })) : (_jsxs(Button, { disabled: busy, onClick: () => run(() => initEvent(LIGHTS_OUT_UTC)), children: [_jsx(Flag, { size: 20, weight: "regular" }), " Initialize event"] }))] }), event ? (_jsxs("form", { className: "mt-6 flex flex-wrap items-end gap-3", onSubmit: (e) => {
                    e.preventDefault();
                    if (!lights)
                        return;
                    void run(() => setLightsOut(new Date(lights).toISOString()));
                }, children: [_jsxs("label", { className: "flex flex-col gap-1 text-sm text-muted", children: ["Lights out (your local time)", _jsx("input", { type: "datetime-local", value: lights, onChange: (e) => setLights(e.target.value), className: `min-h-12 rounded-lg border border-line bg-raised px-3 font-mono text-[1rem] text-ink ${focus}` })] }), _jsx(Button, { type: "submit", variant: "secondary", disabled: busy || !lights, children: "Move lights out" })] })) : (_jsx("p", { className: "mt-4 text-muted", children: "No event on the grid yet. Initialize it to open entries." })), err && (_jsx("p", { role: "alert", className: "mt-4 text-accent-text", children: err }))] }));
}
