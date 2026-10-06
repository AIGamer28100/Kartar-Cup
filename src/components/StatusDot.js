import { jsx as _jsx } from "react/jsx-runtime";
const COLOR = {
    open: 'bg-accent',
    locked: 'bg-muted',
    scored: 'bg-ink',
};
export default function StatusDot({ status, className = '', }) {
    const breathe = status === 'open' ? 'motion-safe:animate-[breathe_2.4s_ease-in-out_infinite]' : '';
    return (_jsx("span", { "aria-hidden": "true", className: `inline-block size-2.5 rounded-full ${COLOR[status]} ${breathe} ${className}` }));
}
