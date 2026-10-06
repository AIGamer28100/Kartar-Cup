import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { CloudArrowDown, FloppyDisk } from '@phosphor-icons/react';
import Button from '../components/Button';
import { getRace } from '../config/calendar';
import { saveResults } from '../lib/db';
import { fetchRaceFactsForRace, mapFactsToQuestions } from '../lib/raceResults';
import { YESNO_OPTIONS } from '../lib/types';
/** Answer choices come from the live event's own lineup (not a static template), so the ids the
 * host ticks are exactly the ids guests picked from. */
function optionsFor(config, q) {
    if (q.kind === 'yesno')
        return YESNO_OPTIONS;
    if (q.kind === 'team')
        return config.teams.map((t) => ({ id: t.id, label: t.label }));
    return [...config.drivers].sort((a, b) => a.grid - b.grid).map((d) => ({ id: d.id, label: d.label }));
}
export default function ResultsForm({ config, resultsDoc, results, }) {
    const [draft, setDraft] = useState(results);
    const [source, setSource] = useState(resultsDoc?.source ?? '');
    const [busy, setBusy] = useState(false);
    const [pulling, setPulling] = useState(false);
    const [msg, setMsg] = useState(null);
    const [notes, setNotes] = useState([]);
    const savedKey = JSON.stringify(results) + (resultsDoc?.source ?? '');
    useEffect(() => {
        setDraft(results);
        setSource(resultsDoc?.source ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [savedKey]);
    const race = useMemo(() => (config ? getRace(config.raceId) : undefined), [config]);
    function toggle(q, id) {
        setDraft((d) => {
            const cur = d[q] ?? [];
            return { ...d, [q]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] };
        });
    }
    async function save() {
        setBusy(true);
        setMsg(null);
        try {
            await saveResults(draft, source.trim());
            setMsg({ ok: true, text: 'Results saved. Stewards have nothing to add.' });
        }
        catch (e) {
            setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed. Try again.' });
        }
        finally {
            setBusy(false);
        }
    }
    async function pull() {
        if (!config || !race)
            return;
        setPulling(true);
        setMsg(null);
        setNotes([]);
        try {
            const res = await fetchRaceFactsForRace(race.season, race);
            if (!res.ok) {
                setMsg({ ok: false, text: res.reason });
                return;
            }
            const mapped = mapFactsToQuestions(res.facts, config.questions, {
                team: new Set(config.teams.map((t) => t.id)),
                driver: new Set(config.drivers.map((d) => d.id)),
            });
            setDraft((d) => ({ ...d, ...mapped.answers }));
            setSource(`OpenF1 race session ${res.sessionKey}, pulled ${new Date().toLocaleString('en-GB')}`);
            setNotes([...res.facts.notes, ...mapped.skipped]);
            setMsg({
                ok: true,
                text: `Filled ${mapped.filled.length} of ${config.questions.filter((q) => q.kind !== 'yesno').length} questions from OpenF1. Check them, then save.`,
            });
        }
        finally {
            setPulling(false);
        }
    }
    if (!config) {
        return (_jsxs("section", { "aria-label": "Results", className: "border-b border-line py-8", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Race results" }), _jsx("p", { className: "mt-1 text-muted", children: "No event is live. Set one live in Settings to enter results." })] }));
    }
    return (_jsxs("section", { "aria-label": "Results", className: "border-b border-line py-8", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Race results" }), _jsx("p", { className: "mt-1 text-muted", children: "Tick every accepted answer. Leave a question empty to void it, nobody scores on it." }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-3", children: [_jsxs(Button, { variant: "secondary", disabled: !race || pulling, onClick: () => void pull(), children: [_jsx(CloudArrowDown, { size: 20, weight: "regular", className: pulling ? 'animate-pulse' : undefined }), pulling ? 'Pulling...' : 'Pull from OpenF1'] }), _jsx("p", { className: "text-sm text-muted", children: race
                            ? 'Fills the draft from the finished race. Nothing is saved until you press Save.'
                            : 'Custom events have no calendar race to pull from.' })] }), notes.length > 0 && (_jsx("ul", { className: "mt-3 list-disc space-y-1 pl-5 text-sm text-muted", children: notes.map((n) => (_jsx("li", { children: n }, n))) })), _jsx("div", { className: "mt-6 divide-y divide-line", children: config.questions.map((q, i) => {
                    const saved = results[q.id] ?? [];
                    const opts = optionsFor(config, q);
                    const picked = draft[q.id] ?? [];
                    return (_jsxs("fieldset", { className: "py-5", children: [_jsxs("legend", { className: "mb-3 text-xl", children: [_jsx("span", { className: "mr-3 font-mono text-muted", children: i + 1 }), q.prompt] }), _jsxs("p", { className: "mb-3 text-sm text-muted", children: ["Saved:", ' ', _jsx("span", { className: "font-mono text-ink", children: saved.length
                                            ? saved.map((id) => opts.find((o) => o.id === id)?.label ?? id).join(', ')
                                            : 'voided or not set' })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: opts.map((o) => {
                                    const on = picked.includes(o.id);
                                    return (_jsx("button", { type: "button", "aria-pressed": on, onClick: () => toggle(q.id, o.id), className: `min-h-11 rounded-lg border px-4 text-[1rem] transition duration-150 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${on
                                            ? 'border-accent bg-accent text-accent-ink'
                                            : 'border-line bg-raised text-ink hover:border-muted'}`, children: o.label }, o.id));
                                }) }), picked.length > 0 && (_jsx("button", { type: "button", onClick: () => setDraft((d) => ({ ...d, [q.id]: [] })), className: "mt-3 min-h-11 text-sm text-muted underline hover:text-ink focus-visible:outline-2 focus-visible:outline-accent", children: "Void this question" }))] }, q.id));
                }) }), _jsxs("label", { className: "mt-2 flex flex-col gap-1 text-sm text-muted", children: ["Source note", _jsx("input", { value: source, onChange: (e) => setSource(e.target.value), placeholder: "e.g. official timing sheet, lap 41 review", className: "min-h-12 rounded-lg border border-line bg-raised px-3 text-[1rem] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" })] }), _jsxs("div", { className: "mt-4 flex flex-wrap items-center gap-4", children: [_jsxs(Button, { disabled: busy, onClick: save, children: [_jsx(FloppyDisk, { size: 20, weight: "regular" }), " Save results"] }), msg && (_jsx("p", { role: msg.ok ? 'status' : 'alert', className: msg.ok ? 'text-muted' : 'text-accent-text', children: msg.text }))] })] }));
}
