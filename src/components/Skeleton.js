import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Shell, Split } from '../guest/parts';
/** Shimmer block: opacity pulse only, disabled under prefers-reduced-motion. */
export default function Skeleton({ className = '' }) {
    return (_jsx("div", { "aria-hidden": "true", className: `rounded-lg bg-raised motion-safe:animate-pulse ${className}` }));
}
/** Wraps skeleton content: announces busy state to assistive tech with a visually hidden label. */
export function Busy({ children, className = '' }) {
    return (_jsxs("div", { "aria-busy": "true", role: "status", className: className, children: [_jsx("span", { className: "sr-only", children: "Loading" }), children] }));
}
/** Guest-layout skeleton: eyebrow, headline, copy, and a right-hand action block (matches Split). */
export function PageSkeleton() {
    return (_jsx(Shell, { bare: true, children: _jsx(Busy, { className: "flex flex-1 flex-col", children: _jsx(Split, { left: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Skeleton, { className: "h-4 w-40" }), _jsx(Skeleton, { className: "mt-2 h-14 w-full max-w-md" }), _jsx(Skeleton, { className: "h-14 w-3/4 max-w-sm" }), _jsx(Skeleton, { className: "mt-2 h-6 w-full max-w-[34ch]" }), _jsx(Skeleton, { className: "mt-6 h-16 w-56" })] }), right: _jsxs("div", { className: "flex flex-col gap-4", children: [_jsx(Skeleton, { className: "h-28 w-full" }), _jsx(Skeleton, { className: "h-12 w-full" })] }) }) }) }));
}
/** Host-layout skeleton: stacked rows under the header. */
export function RowsSkeleton({ rows = 4 }) {
    return (_jsxs(Busy, { className: "mt-8 space-y-4", children: [_jsx(Skeleton, { className: "h-32" }), Array.from({ length: rows - 1 }, (_, i) => (_jsx(Skeleton, { className: "h-16" }, i)))] }));
}
