import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useState } from 'react';
import Button from '../../components/Button';
import { setScreenState } from '../../lib/db';
import { MODE_LABEL, nextStage, prevStage } from './podium';
import { useScreenData } from './useScreenData';
const REVEAL_LABEL = {
    0: 'Reveal P3',
    1: 'Reveal P2',
    2: 'Reveal P1',
    3: 'Fully revealed',
};
/** Meant to be used from a phone while the big screen is elsewhere: same host-only actions as
 * ScreenApp's own keyboard/hint bar, as big touch targets. Low motion (R20) — this panel is an
 * internal tool, only /host/screen itself gets the high public budget. */
export default function PodiumController() {
    const { loading, error, eventId, screenState } = useScreenData();
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const run = useCallback(async (p) => {
        if (!eventId)
            return;
        setBusy(true);
        setErr(null);
        try {
            await setScreenState(eventId, p);
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'The screen did not answer. Try again.');
        }
        finally {
            setBusy(false);
        }
    }, [eventId]);
    const stage = screenState.stage;
    const mode = screenState.mode;
    if (loading) {
        return (_jsx("section", { "aria-label": "Big screen control", className: "border-t border-line py-8", children: _jsx("div", { className: "h-24 animate-pulse rounded-lg bg-raised" }) }));
    }
    if (error || !eventId) {
        return (_jsx("section", { "aria-label": "Big screen control", className: "border-t border-line py-8", children: _jsx("p", { className: "text-muted", children: error ?? 'No live event right now.' }) }));
    }
    const modeBtn = (m) => (_jsx(Button, { variant: mode === m ? 'primary' : 'secondary', disabled: busy, onClick: () => run({ mode: m }), className: "min-w-28", children: MODE_LABEL[m] }, m));
    return (_jsxs("section", { "aria-label": "Big screen control", className: "border-t border-line py-8", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-4", children: [_jsx("h2", { className: "text-2xl font-semibold", children: "Big screen" }), _jsx("a", { href: "/host/screen", target: "_blank", rel: "noreferrer", className: "text-sm text-muted underline hover:text-ink", children: "Open big screen \u2197" })] }), _jsxs("p", { className: "mt-2 font-mono text-sm text-muted", "aria-live": "polite", children: ["Mode: ", MODE_LABEL[mode], " \u00B7 Stage: ", stage, "/3"] }), _jsx("div", { className: "mt-4 flex flex-wrap gap-2", children: ['lobby', 'standings', 'podium'].map(modeBtn) }), mode === 'podium' && (_jsxs("div", { className: "mt-6 flex flex-wrap items-center gap-3", children: [_jsx(Button, { disabled: busy || stage >= 3, onClick: () => run({ mode: 'podium', stage: nextStage(stage) }), className: "min-h-14 min-w-48 text-lg", children: REVEAL_LABEL[stage] }), _jsx(Button, { variant: "secondary", disabled: busy || stage <= 0, onClick: () => run({ stage: prevStage(stage) }), children: "Back" }), _jsx(Button, { variant: "ghost", disabled: busy || stage === 0, onClick: () => run({ stage: 0 }), children: "Reset" })] })), err && (_jsx("p", { role: "alert", className: "mt-3 text-accent-text", children: err }))] }));
}
