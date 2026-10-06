import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowClockwise, House } from '@phosphor-icons/react';
import Button, { buttonCls } from './Button';
import { Eyebrow, H1, Reveal, Shell, Split } from '../guest/parts';
/**
 * Reusable failure screen. Router-free on purpose (plain anchor + reload) so the top-level
 * ErrorBoundary can render it even when the router itself is what broke.
 */
export default function FailurePage({ error, onRetry }) {
    const summary = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
    return (_jsx(Shell, { bare: true, children: _jsx(Split, { left: _jsxs(Reveal, { children: [_jsx(Eyebrow, { children: "Red flag" }), _jsx("h1", { className: `mt-3 ${H1}`, role: "alert", children: "Red flag. Something broke." }), _jsx("p", { className: "mt-3 max-w-[40ch] text-muted md:text-lg", children: "Race control lost the feed. Nothing you did, probably. Give the marshals a second and try again." }), summary && (_jsx("p", { className: "mt-6 max-w-[48ch] break-words border-l-2 border-accent pl-4 font-mono text-sm text-muted", children: summary.slice(0, 240) }))] }), right: _jsxs(Reveal, { index: 1, className: "flex max-w-md flex-col gap-3", children: [_jsxs(Button, { onClick: onRetry ?? (() => window.location.reload()), children: [_jsx(ArrowClockwise, { size: 20, weight: "regular", "aria-hidden": "true" }), "Try again"] }), _jsxs("a", { href: "/", className: buttonCls('secondary'), children: [_jsx(House, { size: 20, weight: "regular", "aria-hidden": "true" }), "Back to home"] })] }) }) }));
}
