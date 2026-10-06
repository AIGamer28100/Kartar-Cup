import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { MAX_QUESTION_POINTS } from '../../lib/types';
import { MAX_QUESTIONS } from './model';
import { Field, Section, iconBtn, inputCls } from './ui';
function move(arr, i, d) {
    const j = i + d;
    if (j < 0 || j >= arr.length)
        return arr;
    const c = [...arr];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
}
export function QuestionsEditor({ form, errors, patch }) {
    const set = (id, p) => patch((f) => ({ questions: f.questions.map((q) => (q.id === id ? { ...q, ...p } : q)) }));
    return (_jsxs(Section, { title: "Questions", intro: "Up to 8. Question ids stay fixed once issued, so existing picks keep matching. Points (1 to 10) is what a right answer adds to the score.", children: [_jsx("ol", { className: "divide-y divide-line border-y border-line", children: form.questions.map((q, i) => (_jsxs("li", { className: "grid grid-cols-1 gap-3 py-4 md:grid-cols-[1fr_12rem_6rem_auto]", children: [_jsx(Field, { id: `q-prompt-${q.id}`, label: `Question ${i + 1} prompt (${q.id})`, children: _jsx("input", { id: `q-prompt-${q.id}`, className: inputCls, value: q.prompt, maxLength: 140, onChange: (e) => set(q.id, { prompt: e.target.value }) }) }), _jsx(Field, { id: `q-kind-${q.id}`, label: "Answer kind", children: _jsxs("select", { id: `q-kind-${q.id}`, className: inputCls, value: q.kind, onChange: (e) => set(q.id, { kind: e.target.value }), children: [_jsx("option", { value: "team", children: "Team" }), _jsx("option", { value: "driver", children: "Driver" }), _jsx("option", { value: "yesno", children: "Yes / No" })] }) }), _jsx(Field, { id: `q-points-${q.id}`, label: "Points", children: _jsx("input", { id: `q-points-${q.id}`, type: "number", inputMode: "numeric", min: 1, max: MAX_QUESTION_POINTS, step: 1, className: `${inputCls} font-mono tabular-nums`, value: q.points ?? 1, onChange: (e) => set(q.id, { points: Math.min(MAX_QUESTION_POINTS, Math.max(1, Math.round(Number(e.target.value)) || 1)) }) }) }), _jsxs("div", { className: "flex items-end gap-1", children: [_jsx("button", { type: "button", className: iconBtn, "aria-label": `Move question ${i + 1} up`, disabled: i === 0, onClick: () => patch((f) => ({ questions: move(f.questions, i, -1) })), children: _jsx(ArrowUp, { size: 20, weight: "regular" }) }), _jsx("button", { type: "button", className: iconBtn, "aria-label": `Move question ${i + 1} down`, disabled: i === form.questions.length - 1, onClick: () => patch((f) => ({ questions: move(f.questions, i, 1) })), children: _jsx(ArrowDown, { size: 20, weight: "regular" }) }), _jsx("button", { type: "button", className: iconBtn, "aria-label": `Remove question ${i + 1}`, disabled: form.questions.length <= 1, onClick: () => patch((f) => ({ questions: f.questions.filter((x) => x.id !== q.id) })), children: _jsx(Trash, { size: 20, weight: "regular" }) })] }), _jsx(Field, { id: `q-hint-${q.id}`, label: "Hint (optional)", className: "md:col-span-4", children: _jsx("input", { id: `q-hint-${q.id}`, className: inputCls, value: q.hint ?? '', maxLength: 200, onChange: (e) => set(q.id, { hint: e.target.value }) }) })] }, q.id))) }), errors.questions && (_jsx("p", { role: "alert", className: "mt-3 text-sm text-accent-text", children: errors.questions })), _jsxs(Button, { variant: "secondary", className: "mt-4", disabled: form.questions.length >= MAX_QUESTIONS, onClick: () => patch((f) => {
                    const n = f.qCounter + 1;
                    return { qCounter: n, questions: [...f.questions, { id: `q${n}`, prompt: '', kind: 'driver' }] };
                }), children: [_jsx(Plus, { size: 20, weight: "regular" }), " Add question (", form.questions.length, "/", MAX_QUESTIONS, ")"] })] }));
}
