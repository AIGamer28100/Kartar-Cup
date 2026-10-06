import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { DiceFive } from '@phosphor-icons/react';
import Button from '../components/Button';
import { assignCards, cardImageSrc, drawRandomPlayCard, nextPassNumber, watchCards } from '../lib/cards';
import { inputCls } from './settings/ui';
/** Door-side card handout (R45): the host gives the guest their VIP pass number and records the Play
 * card they drew at random from the physical deck (pick it, or press Draw for a digital random draw).
 * The card is copied onto the guest's own booking so only they see it (R15), and its points are added
 * to their quiz score (R46). Safe to repeat: the pass number is kept, the Play card can be corrected. */
export default function CardAssign({ booking, event }) {
    const [cards, setCards] = useState([]);
    const [pass, setPass] = useState(booking.passNumber);
    const [play, setPlay] = useState(booking.playCard ?? null);
    const [pick, setPick] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => {
        if (!event)
            return;
        return watchCards(event.id, setCards, () => setCards([]));
    }, [event]);
    const plays = cards.filter((c) => c.kind === 'play');
    const next = event ? nextPassNumber(event) : undefined;
    async function assign() {
        setBusy(true);
        setErr('');
        try {
            const chosen = plays.find((c) => c.id === pick) ?? null;
            const r = await assignCards(booking.id, chosen);
            setPass(r.passNumber);
            setPlay(r.playCard);
            setPick('');
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not assign the cards.');
        }
        finally {
            setBusy(false);
        }
    }
    function draw() {
        const c = drawRandomPlayCard(plays);
        if (c)
            setPick(c.id);
    }
    const src = cardImageSrc(play);
    return (_jsxs("div", { className: "mt-4 rounded-lg border border-line p-4", children: [_jsx("p", { className: "text-sm font-medium", children: "VIP pass and Play card" }), pass != null && (_jsxs("p", { className: "mt-2 flex items-center gap-3", children: [src && _jsx("img", { src: src, alt: "", className: "h-16 w-auto rounded border border-line object-contain" }), _jsxs("span", { className: "font-mono tabular-nums", children: ["Pass #", pass, play && (_jsxs("span", { className: "block text-sm text-muted", children: [play.code ?? play.driverName, " - ", play.points, " pts"] }))] })] })), plays.length > 0 ? (_jsxs("div", { className: "mt-3 flex flex-wrap items-center gap-2", children: [_jsxs("select", { className: `${inputCls} min-w-0 flex-1`, value: pick, onChange: (e) => setPick(e.target.value), "aria-label": "Play card the guest drew", children: [_jsx("option", { value: "", children: play ? 'Keep current Play card' : 'Choose the Play card drawn' }), plays.map((c) => (_jsxs("option", { value: c.id, children: [c.code ?? c.driverName, c.number != null ? ` #${c.number}` : '', " - ", c.points, " pts"] }, c.id)))] }), _jsxs(Button, { variant: "secondary", className: "min-h-11 px-3", onClick: draw, "aria-label": "Draw a random Play card", children: [_jsx(DiceFive, { size: 20, weight: "regular", "aria-hidden": "true" }), "Draw"] })] })) : (_jsx("p", { className: "mt-2 text-sm text-muted", children: "No Play cards set up for this event yet (Host > Bookings > Cards)." })), _jsx(Button, { className: "mt-3 min-h-11", disabled: busy || (pass != null && !pick), onClick: () => void assign(), children: busy ? 'Saving...' : pass == null ? `Assign pass${next ? ` #${next}` : ''}${pick ? ' + card' : ''}` : 'Update Play card' }), err && _jsx("p", { role: "alert", className: "mt-2 text-sm text-accent-text", children: err })] }));
}
