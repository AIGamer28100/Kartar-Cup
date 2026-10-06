import { jsx as _jsx } from "react/jsx-runtime";
import { useRef } from 'react';
/** Minimal, fast tablist: arrow keys move + select, Home/End jump to the ends (R20: no springs, no motion budget spent here). */
export function TabList({ tabs, active, onChange, label, }) {
    const ref = useRef(null);
    function onKeyDown(e) {
        const i = tabs.findIndex((t) => t.id === active);
        let next = -1;
        if (e.key === 'ArrowRight')
            next = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft')
            next = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home')
            next = 0;
        else if (e.key === 'End')
            next = tabs.length - 1;
        if (next < 0)
            return;
        e.preventDefault();
        onChange(tabs[next].id);
        ref.current?.querySelectorAll('[role="tab"]')[next]?.focus();
    }
    return (_jsx("div", { ref: ref, role: "tablist", "aria-label": label, onKeyDown: onKeyDown, className: "flex gap-1 overflow-x-auto border-b border-line", children: tabs.map((t) => {
            const selected = t.id === active;
            return (_jsx("button", { type: "button", role: "tab", id: `tab-${t.id}`, "aria-selected": selected, "aria-controls": `panel-${t.id}`, tabIndex: selected ? 0 : -1, onClick: () => onChange(t.id), className: `min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${selected ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`, children: t.label }, t.id));
        }) }));
}
/** Instant switch with a very short opacity fade-in — no spring, this is the internal-tool area (R20). */
export function TabPanel({ id, active, children }) {
    if (!active)
        return null;
    return (_jsx("div", { role: "tabpanel", id: `panel-${id}`, "aria-labelledby": `tab-${id}`, tabIndex: 0, className: "animate-[settings-fade_120ms_ease-out] pt-6", children: children }));
}
