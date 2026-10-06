import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Trophy } from '@phosphor-icons/react';
import Button from '../components/Button';
import { revealWinner } from '../lib/db';
// Host tools stay low-motion (R20): quick opacity/transform fade, no spring bounce.
const fast = { duration: 0.18, ease: 'easeOut' };
export default function RevealWinner({ winner, overrideUid, revealed, max = 5, }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const [show, setShow] = useState(false);
    const reduce = useReducedMotion();
    async function reveal() {
        setBusy(true);
        setErr(null);
        try {
            await revealWinner(overrideUid);
            setShow(true);
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'Reveal failed. Try again.');
        }
        finally {
            setBusy(false);
        }
    }
    const item = (delay) => ({
        initial: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: reduce ? { duration: 0.01 } : { ...fast, delay: delay * 0.08 },
    });
    return (_jsxs("section", { "aria-label": "Winner", className: "border-t border-line py-8", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs(Button, { disabled: busy || !winner, onClick: reveal, children: [_jsx(Trophy, { size: 20, weight: "regular" }), revealed ? 'Replay the reveal' : 'Reveal the winner'] }), !winner && _jsx("p", { className: "text-muted", children: "Nobody to crown yet." })] }), err && (_jsx("p", { role: "alert", className: "mt-3 text-accent-text", children: err })), _jsx(AnimatePresence, { children: show && winner && (_jsx(motion.div, { role: "dialog", "aria-label": "Winner", className: "fixed inset-0 z-50 grid place-items-center bg-base p-6 md:p-16 lg:p-24", initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, children: _jsxs("div", { className: "max-w-full text-left", children: [_jsx(motion.p, { ...item(0.1), className: "text-xl uppercase tracking-widest text-muted md:text-3xl", children: "Chequered flag. Your winner" }), _jsx(motion.p, { ...item(0.5), className: "mt-6 break-words text-[clamp(2.5rem,9vw,8rem)] font-semibold leading-none", children: winner.name }), _jsxs(motion.p, { ...item(1), className: "mt-6 font-mono text-5xl tabular-nums text-accent-text md:text-6xl", children: [winner.score, " / ", max] }), _jsx(motion.div, { ...item(1.5), className: "mt-10", children: _jsx(Button, { variant: "secondary", onClick: () => setShow(false), children: "Back to the pit wall" }) })] }) })) })] }));
}
