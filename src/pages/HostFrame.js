import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SignOut } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { buttonCls } from '../components/Button';
import { SITE_TITLE } from '../config/event';
/** Host page chrome: title bar with a Sign out link (when signed in). */
export function HostFrame({ children, signedIn }) {
    return (_jsxs("main", { className: "mx-auto min-h-[100dvh] max-w-[87.5rem] bg-base px-6 py-8 text-ink md:px-10 lg:px-16", children: [_jsxs("header", { className: "flex items-center justify-between gap-4 border-b border-line pb-4", children: [_jsxs("h1", { className: "text-xl font-semibold md:text-3xl", children: [SITE_TITLE, " ", _jsx("span", { className: "text-muted", children: "pit wall" })] }), signedIn && (_jsxs(Link, { to: "/logout", className: buttonCls('ghost', 'whitespace-nowrap'), children: [_jsx(SignOut, { size: 20, weight: "regular", "aria-hidden": "true" }), " Sign out"] }))] }), children] }));
}
