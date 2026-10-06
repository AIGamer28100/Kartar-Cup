import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { boldCalls, crowdBreakdown, roomAccuracy } from '../lib/crowd';
import { normalize } from '../lib/scoring';
import { YESNO_OPTIONS } from '../lib/types';
const pct = (share) => `${Math.round(share * 100)}%`;
/** Three-letter code: driver surname / team name start, e.g. "Max Verstappen" -> VER. */
function codeOf(label) {
    const words = label.trim().split(/\s+/);
    const key = words.length > 1 ? words[words.length - 1] : words[0];
    return key.slice(0, 3).toUpperCase();
}
function optionMap(config, q) {
    const src = q?.kind === 'yesno' ? YESNO_OPTIONS : q?.kind === 'team' ? config.teams : config.drivers;
    return new Map(src.map((o) => [normalize(o.id), { label: o.label, code: codeOf(o.label) }]));
}
function Bar({ share, actual, delay, reduce }) {
    return (_jsx("div", { className: "relative h-4 w-full border-l border-ink/40", children: _jsx(motion.div, { initial: reduce ? false : { scaleX: 0, opacity: 0 }, animate: { scaleX: 1, opacity: 1 }, transition: { duration: 0.25, delay, ease: 'easeOut' }, style: { width: `${Math.max(share * 100, share > 0 ? 1.5 : 0)}%`, transformOrigin: 'left' }, className: `h-full ${actual ? 'border-2 border-accent bg-accent/25' : 'bg-muted/60'}` }) }));
}
function QuestionRow({ b, q, config, index, reduce, }) {
    const opts = optionMap(config, q);
    const acceptedNorm = b.accepted.map(normalize);
    const shown = b.picks.slice(0, 3);
    const missing = acceptedNorm
        .filter((id) => !shown.some((p) => p.optionId === id))
        .map((id) => ({ optionId: id, count: 0, share: 0 }));
    const rows = [...shown, ...missing];
    return (_jsxs("li", { className: "py-5", children: [_jsxs("div", { className: "flex flex-wrap items-baseline justify-between gap-x-4", children: [_jsx("h3", { className: "text-[1.125rem] font-semibold", children: q?.prompt ?? b.questionId }), _jsx("p", { className: "font-mono text-sm tabular-nums text-muted", children: b.voided ? 'Voided' : `${b.roomRight} of ${b.total} right (${pct(b.roomRightShare)})` })] }), b.total === 0 ? (_jsx("p", { className: "mt-2 text-muted", children: "No picks on this one." })) : (_jsx("ul", { className: "mt-3 space-y-2", children: rows.map((p, i) => {
                    const o = opts.get(p.optionId);
                    const actual = acceptedNorm.includes(p.optionId);
                    return (_jsxs("li", { className: "grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_5.5rem] items-center gap-x-3 md:grid-cols-[14rem_minmax(0,1fr)_7rem]", children: [_jsxs("span", { className: "min-w-0 truncate", children: [_jsx("span", { className: "font-mono text-sm tabular-nums text-muted", children: o?.code ?? '---' }), ' ', _jsx("span", { className: "text-[1rem]", children: o?.label ?? p.optionId })] }), _jsxs("span", { className: "flex items-center gap-2", children: [_jsx(Bar, { share: p.share, actual: actual, delay: reduce ? 0 : index * 0.05 + i * 0.04, reduce: reduce }), actual && (_jsx("span", { className: "shrink-0 rounded-sm border border-accent px-1.5 py-0.5 text-xs uppercase tracking-widest text-accent-text", children: "Actual" }))] }), _jsxs("span", { className: "text-right font-mono text-sm tabular-nums", children: [p.count, " / ", pct(p.share)] })] }, p.optionId));
                }) }))] }));
}
export default function CrowdReveal({ config, entries, results, }) {
    const reduce = !!useReducedMotion();
    const ids = config?.questionIds;
    const hasResults = Object.values(results).some((r) => r.length > 0);
    const model = useMemo(() => {
        if (!ids)
            return null;
        const scorable = entries.map((e) => ({
            uid: e.uid,
            name: e.name,
            answers: e.answers,
            submittedAtMs: e.submittedAt.toMillis(),
        }));
        const breakdown = crowdBreakdown(scorable, results, ids);
        return { breakdown, acc: roomAccuracy(breakdown), bold: boldCalls(scorable, results, ids) };
    }, [entries, results, ids]);
    if (!config || !model || !hasResults || entries.length === 0)
        return null;
    const { breakdown, acc, bold } = model;
    const qOf = (id) => config.questions.find((q) => q.id === id);
    const labelOf = (questionId, optionId) => optionMap(config, qOf(questionId)).get(normalize(optionId))?.label ?? optionId;
    return (_jsxs("section", { "aria-label": "Crowd vs reality", className: "py-8", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Crowd vs reality" }), _jsxs("div", { className: "mt-4", children: [_jsxs("p", { className: "flex items-baseline gap-3", children: [_jsx("span", { className: "text-lg text-muted", children: "Room accuracy" }), _jsxs("span", { className: "font-mono text-5xl font-semibold tabular-nums md:text-7xl", children: [acc.percent, "%"] })] }), _jsxs("div", { role: "meter", "aria-label": "Room accuracy", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": acc.percent, "aria-valuetext": `${acc.percent} percent`, className: "relative mt-3 h-6 border border-line", children: [_jsx(motion.div, { initial: reduce ? false : { scaleX: 0 }, animate: { scaleX: 1 }, transition: { duration: 0.4, ease: 'easeOut' }, style: { width: `${acc.percent}%`, transformOrigin: 'left' }, className: "h-full bg-accent" }), [25, 50, 75].map((t) => (_jsx("span", { "aria-hidden": true, className: "absolute inset-y-0 w-px bg-ink/50", style: { left: `${t}%` } }, t)))] }), _jsx("div", { "aria-hidden": true, className: "relative mt-1 h-4 font-mono text-xs tabular-nums text-muted", children: [0, 25, 50, 75, 100].map((t) => (_jsx("span", { className: "absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full", style: { left: `${t}%` }, children: t }, t))) }), _jsxs("p", { className: "mt-2 text-sm text-muted", children: ["Average share of the room that got each question right, across ", acc.scored, " scored question", acc.scored === 1 ? '' : 's', ". Voided questions are left out."] })] }), _jsx("ul", { className: "mt-4 divide-y divide-line", children: breakdown.map((b, i) => (_jsx(QuestionRow, { b: b, q: qOf(b.questionId), config: config, index: i, reduce: reduce }, b.questionId))) }), _jsx("h3", { className: "mt-6 text-xl font-semibold", children: "Bold calls" }), bold.length === 0 ? (_jsx("p", { className: "mt-2 text-muted", children: "No bold calls this race. Needs 5 or more picks and a right answer under 20% of the room." })) : (_jsx("ul", { className: "mt-2 divide-y divide-line", children: bold.map((c) => (_jsxs("li", { className: "flex flex-wrap items-baseline justify-between gap-x-4 py-3", children: [_jsxs("span", { className: "text-[1rem]", children: [_jsx("span", { className: "font-semibold", children: c.name }), " called ", labelOf(c.questionId, c.optionId), _jsxs("span", { className: "text-muted", children: [" on ", qOf(c.questionId)?.prompt ?? c.questionId] })] }), _jsxs("span", { className: "font-mono text-sm tabular-nums text-accent-text", children: ["only ", pct(c.share), " of the room"] })] }, `${c.uid}-${c.questionId}`))) }))] }));
}
