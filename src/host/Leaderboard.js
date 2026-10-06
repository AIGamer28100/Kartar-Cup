import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from '@phosphor-icons/react';
import Button from '../components/Button';
import { QUESTIONS } from '../config/event';
import { pointsOf } from '../lib/scoring';
// Host tools stay low-motion (R20): a quick linear reorder, no spring bounce.
const reorder = { duration: 0.18, ease: 'easeOut' };
export default function Leaderboard({ rows, overrideUid, canPick, questions, onPick, }) {
    const [pending, setPending] = useState(null);
    if (rows.length === 0) {
        return (_jsx("section", { "aria-label": "Leaderboard", className: "py-16", children: _jsx("p", { className: "text-2xl text-muted", children: "No picks yet, the grid is quiet." }) }));
    }
    const top = rows[0].score;
    const qs = questions ?? QUESTIONS;
    return (_jsxs("section", { "aria-label": "Leaderboard", className: "py-8", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Leaderboard" }), _jsx("ol", { className: "mt-4 divide-y divide-line", children: rows.map((r) => {
                    const tiedTop = canPick && r.tiedOnScore && r.score === top;
                    const chosen = overrideUid === r.uid;
                    const inner = (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-left font-mono text-xl tabular-nums text-muted md:text-3xl 2xl:text-4xl", children: r.rank }), _jsxs("span", { className: "min-w-0 truncate text-left text-[1.375rem] font-semibold leading-tight md:text-4xl 2xl:text-5xl", children: [r.name, chosen && (_jsx("span", { className: "ml-3 align-middle text-sm font-normal uppercase tracking-widest text-accent-text", children: "tiebreak" }))] }), _jsx("span", { className: "hidden gap-1.5 sm:flex", role: "img", "aria-label": qs
                                    .map((q, i) => `${i + 1} ${r.ticks[q.id] ? 'right' : 'wrong'}${pointsOf(q) > 1 ? ` (${pointsOf(q)} points)` : ''}`)
                                    .join(', '), children: qs.map((q) => (_jsx("span", { title: pointsOf(q) > 1 ? `${q.prompt} (${pointsOf(q)} points)` : q.prompt, className: `grid size-9 place-items-center rounded-md border ${r.ticks[q.id] ? 'border-accent text-accent-text' : 'border-line text-muted'}`, children: r.ticks[q.id] ? (_jsx(Check, { size: 20, weight: "regular" })) : (_jsx(X, { size: 16, weight: "regular" })) }, q.id))) }), _jsxs("span", { className: "text-right font-num text-4xl font-extrabold italic tabular-nums text-gold md:text-6xl 2xl:text-7xl", children: [r.score, (r.bonus ?? 0) > 0 && (_jsxs("span", { className: "block text-xs text-muted md:text-sm 2xl:text-base", children: [r.quizScore ?? 0, " + ", r.bonus, " card"] }))] })] }));
                    const rowCls = 'grid w-full grid-cols-[2rem_minmax(0,1fr)_3rem] items-center gap-x-3 py-4 sm:grid-cols-[3rem_minmax(0,1fr)_auto_4.5rem] md:grid-cols-[4rem_minmax(0,1fr)_auto_6rem] md:gap-x-6 md:py-5 2xl:grid-cols-[6rem_minmax(0,1fr)_auto_8rem] 2xl:py-6';
                    return (_jsxs(motion.li, { layout: true, transition: reorder, children: [tiedTop ? (_jsx("button", { type: "button", onClick: () => setPending(pending === r.uid ? null : r.uid), "aria-label": `${r.name}, tied on ${r.score}. Set as tiebreak winner`, className: `${rowCls} transition duration-150 hover:bg-raised active:scale-[0.995] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`, children: inner })) : (_jsx("div", { className: rowCls, children: inner })), pending === r.uid && (_jsxs("div", { className: "flex flex-wrap items-center gap-3 pb-4", role: "group", children: [_jsxs("p", { className: "text-lg", children: [chosen ? 'Clear the tiebreak on' : 'Give the tiebreak to', " ", r.name, "?"] }), _jsx(Button, { onClick: () => {
                                            onPick(chosen ? null : r.uid);
                                            setPending(null);
                                        }, children: "Confirm" }), _jsx(Button, { variant: "ghost", onClick: () => setPending(null), children: "Cancel" })] }))] }, r.uid));
                }) })] }));
}
