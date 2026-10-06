import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, X } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { getResult, saveResult } from '../../lib/cup';
import { Field, iconBtn, inputCls, linkBtn } from '../settings/ui';
/** Enter one round's finishing order. Tap a driver to add them as the next finisher (or as a DNF),
 * then reorder with up/down. Works on a phone: every control is 44px. Saving also refreshes standings. */
export default function ResultsEditor({ seasonId, round, drivers, onClose, }) {
    const [order, setOrder] = useState([]);
    const [dnf, setDnf] = useState([]);
    const [fastest, setFastest] = useState('');
    const [state, setState] = useState('loading');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState(null);
    useEffect(() => {
        let live = true;
        getResult(seasonId, round.id).then((r) => {
            if (!live)
                return;
            setOrder(r?.order ?? []);
            setDnf(r?.dnf ?? []);
            setFastest(r?.fastestLap ?? '');
            setState('ready');
        }, () => live && setState('failed'));
        return () => {
            live = false;
        };
    }, [seasonId, round.id]);
    const name = (id) => drivers.find((d) => d.id === id)?.name ?? 'Removed driver';
    const known = new Set(drivers.map((d) => d.id));
    const placed = new Set([...order, ...dnf]);
    const free = drivers.filter((d) => !placed.has(d.id));
    const move = (i, by) => setOrder((o) => {
        const j = i + by;
        if (j < 0 || j >= o.length)
            return o;
        const n = [...o];
        [n[i], n[j]] = [n[j], n[i]];
        return n;
    });
    async function save() {
        setBusy(true);
        setMsg(null);
        try {
            await saveResult(seasonId, round, {
                order: order.filter((id) => known.has(id)),
                dnf: dnf.filter((id) => known.has(id)),
                ...(fastest && known.has(fastest) ? { fastestLap: fastest } : {}),
            });
            setMsg({ ok: true, text: 'Results saved and standings updated.' });
        }
        catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed. Try again.' });
        }
        finally {
            setBusy(false);
        }
    }
    if (state === 'loading')
        return _jsx("p", { className: "py-6 text-muted", role: "status", children: "Loading results." });
    if (state === 'failed')
        return (_jsx("p", { className: "py-6 text-accent-text", role: "alert", children: "Could not load this round\u2019s results. Close and try again." }));
    return (_jsxs("div", { className: "mt-4 rounded-lg border border-line p-4", children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("h4", { className: "text-lg font-semibold", children: ["Results: ", round.name] }), _jsx("button", { type: "button", className: iconBtn, onClick: onClose, "aria-label": "Close results editor", children: _jsx(X, { size: 20, "aria-hidden": "true" }) })] }), drivers.length === 0 && _jsx("p", { className: "mt-3 text-muted", children: "Add drivers to this season first." }), _jsx("h5", { className: "mt-5 text-sm font-medium text-muted", children: "Finishing order" }), order.length === 0 ? (_jsx("p", { className: "mt-2 text-sm text-muted", children: "Nobody placed yet. Tap a driver below to add them as 1st." })) : (_jsx("ol", { className: "mt-2 divide-y divide-line border-y border-line", children: order.map((id, i) => (_jsxs("li", { className: "flex items-center gap-2 py-2", children: [_jsx("span", { className: "w-8 shrink-0 font-mono tabular-nums text-muted", children: i + 1 }), _jsx("span", { className: "min-w-0 flex-1 truncate", children: name(id) }), _jsx("button", { type: "button", className: iconBtn, onClick: () => move(i, -1), disabled: i === 0, "aria-label": `Move ${name(id)} up`, children: _jsx(ArrowUp, { size: 18, "aria-hidden": "true" }) }), _jsx("button", { type: "button", className: iconBtn, onClick: () => move(i, 1), disabled: i === order.length - 1, "aria-label": `Move ${name(id)} down`, children: _jsx(ArrowDown, { size: 18, "aria-hidden": "true" }) }), _jsx("button", { type: "button", className: iconBtn, onClick: () => setOrder((o) => o.filter((x) => x !== id)), "aria-label": `Remove ${name(id)} from the order`, children: _jsx(X, { size: 18, "aria-hidden": "true" }) })] }, id))) })), _jsx("h5", { className: "mt-5 text-sm font-medium text-muted", children: "Did not finish" }), dnf.length === 0 ? (_jsx("p", { className: "mt-2 text-sm text-muted", children: "None." })) : (_jsx("ul", { className: "mt-2 flex flex-wrap gap-2", children: dnf.map((id) => (_jsx("li", { children: _jsxs("button", { type: "button", className: linkBtn, onClick: () => setDnf((d) => d.filter((x) => x !== id)), children: [name(id), " ", _jsx("span", { className: "text-muted", children: "(DNF, tap to clear)" })] }) }, id))) })), _jsx("h5", { className: "mt-5 text-sm font-medium text-muted", children: "Unplaced drivers" }), free.length === 0 ? (_jsx("p", { className: "mt-2 text-sm text-muted", children: "Everyone is placed." })) : (_jsx("ul", { className: "mt-2 grid gap-2 sm:grid-cols-2", children: free.map((d) => (_jsxs("li", { className: "flex items-center gap-2", children: [_jsx("button", { type: "button", className: `${linkBtn} flex-1 justify-start`, onClick: () => setOrder((o) => [...o, d.id]), children: d.name }), _jsx("button", { type: "button", className: linkBtn, onClick: () => setDnf((x) => [...x, d.id]), "aria-label": `Mark ${d.name} as did not finish`, children: "DNF" })] }, d.id))) })), _jsx(Field, { id: "fl", label: "Fastest lap (optional)", className: "mt-5 max-w-xs", children: _jsxs("select", { id: "fl", className: inputCls, value: fastest, onChange: (e) => setFastest(e.target.value), children: [_jsx("option", { value: "", children: "None" }), drivers.map((d) => (_jsx("option", { value: d.id, children: d.name }, d.id)))] }) }), _jsxs("div", { className: "mt-5 flex flex-wrap items-center gap-3", children: [_jsx(Button, { onClick: save, disabled: busy || drivers.length === 0, children: busy ? 'Saving' : 'Save results' }), msg && (_jsx("p", { role: msg.ok ? 'status' : 'alert', className: msg.ok ? 'text-sm text-muted' : 'text-sm text-accent-text', children: msg.text }))] }), _jsx("p", { className: "mt-3 text-sm text-muted", children: "Results count toward standings only when the round is completed and published." })] }));
}
