import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { fetchLiveGrid } from '../../config/event';
import { Section } from './ui';
/** R30/R37: Grid and Teams are sourced live from OpenF1, never hand-edited. This banner always
 * shows where the currently-displayed data came from, so the host never mistakes a stale/
 * provisional grid for the real entry list. */
export function GridStatusBanner({ status }) {
    if (status.kind === 'fetched') {
        const ago = Math.round((Date.now() - status.fetchedAtMs) / 60_000);
        return (_jsxs("p", { className: "text-sm text-muted", children: ["Live from OpenF1 ", ago <= 0 ? 'just now' : `${ago} min ago`, "."] }));
    }
    if (status.kind === 'no-data') {
        return (_jsx("p", { className: "text-sm text-muted", children: "OpenF1 has no entry list for this race yet \u2014 showing the provisional pre-season grid. Refresh closer to the race weekend." }));
    }
    if (status.kind === 'error') {
        return _jsxs("p", { className: "text-sm text-accent-text", children: ["Couldn\u2019t reach OpenF1 (", status.reason, ") \u2014 showing the provisional grid."] });
    }
    return _jsx("p", { className: "text-sm text-muted", children: "As last saved. Refresh to check OpenF1 for updates." });
}
/** Shared refresh control + the once-per-view auto-refresh for a just-loaded saved event
 * (gridStatus 'saved' means this session hasn't actually checked OpenF1 yet). */
export function useGridRefresh(form, patch, race) {
    const [busy, setBusy] = useState(false);
    const autoFired = useRef(false);
    const refresh = async () => {
        if (!race || busy)
            return;
        setBusy(true);
        try {
            const { teams, drivers, gridStatus } = await fetchLiveGrid(race);
            patch(() => ({ teams, drivers, gridStatus }));
        }
        finally {
            setBusy(false);
        }
    };
    useEffect(() => {
        if (autoFired.current)
            return;
        if (!form || !race)
            return;
        if (form.gridStatus.kind !== 'saved')
            return;
        autoFired.current = true;
        void refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form?.id, race?.id]);
    return { busy, refresh };
}
export function RefreshGridButton({ busy, onRefresh, disabled }) {
    return (_jsxs(Button, { variant: "secondary", disabled: disabled || busy, onClick: onRefresh, children: [_jsx(ArrowsClockwise, { size: 20, weight: "regular", className: busy ? 'animate-spin' : undefined }), busy ? 'Refreshing...' : 'Refresh from OpenF1'] }));
}
export function GridView({ form }) {
    return (_jsxs(Section, { title: "Starting grid", intro: "Pulled live from OpenF1, so it can't be edited by hand.", children: [_jsx(GridStatusBanner, { status: form.gridStatus }), _jsxs("div", { "aria-hidden": "true", className: "mt-4 hidden grid-cols-[3rem_1fr_1fr] gap-x-4 border-t border-line pb-2 pt-3 text-sm font-medium text-muted md:grid", children: [_jsx("span", { children: "Pos" }), _jsx("span", { children: "Driver" }), _jsx("span", { children: "Team" })] }), _jsx("ol", { className: "mt-4 divide-y divide-line border-y border-line md:mt-0", children: form.drivers.map((d, i) => {
                    const team = form.teams.find((t) => t.id === d.teamId);
                    return (_jsxs("li", { className: "grid grid-cols-[2.5rem_1fr] gap-x-3 py-3 md:grid-cols-[3rem_1fr_1fr] md:items-center md:gap-x-4", children: [_jsxs("span", { className: "font-mono text-muted", "aria-label": `Grid position ${i + 1}`, children: ["P", i + 1] }), _jsx("span", { className: "text-ink", children: d.label }), _jsx("span", { className: "col-span-2 text-sm text-muted md:col-span-1 md:text-[1rem]", children: team?.label ?? '—' })] }, d.id));
                }) }), form.drivers.length === 0 && _jsx("p", { className: "py-6 text-sm text-muted", children: "No drivers to show yet." })] }));
}
export function TeamsView({ form }) {
    return (_jsxs(Section, { title: "Teams", intro: "Pulled live from OpenF1, so it can't be edited by hand.", children: [_jsx(GridStatusBanner, { status: form.gridStatus }), _jsx("ul", { className: "mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2 xl:grid-cols-3", children: form.teams.map((t) => (_jsx("li", { className: "py-1 text-ink", children: t.label }, t.id))) }), form.teams.length === 0 && _jsx("p", { className: "py-6 text-sm text-muted", children: "No teams to show yet." })] }));
}
