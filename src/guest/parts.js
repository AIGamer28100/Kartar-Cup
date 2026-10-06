import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Check, Gauge, Images, List, SignIn, TicketIcon, User, WhatsappLogo, X } from '@phosphor-icons/react';
import { useAuth } from '../lib/auth';
import { signInGoogle } from '../lib/firebase';
import { isInAppBrowser } from '../lib/inAppBrowser';
import { signInError } from './SignIn';
import { useCountdown } from '../lib/useCountdown';
import Divider from '../components/Divider';
import { CONTACT } from '../config/contact';
import { DEVELOPER, OPERATOR } from '../config/legal';
import { formatRemaining, optionLabel, safeWhatsappUrl } from './model';
export const SPRING = { type: 'spring', stiffness: 260, damping: 26 };
/** Staggered spring reveal wrapper (transform + opacity only). */
export function Reveal({ children, index = 0, className = '', }) {
    const reduce = useReducedMotion();
    return (_jsx(motion.div, { className: className, initial: reduce ? false : { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING, delay: reduce ? 0 : index * 0.07 }, children: children }));
}
const linkCls = '-mx-2 inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
/** Small text wordmark used as the header's logo placeholder — R27: no real Karter Cup artwork
 * is in this repo, only a plain dot+text mark in the site's own established style. Links home. */
function LogoMark() {
    return (_jsxs(Link, { to: "/", className: "-mx-2 inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-2 text-sm font-semibold tracking-tight text-ink transition hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", children: [_jsx("span", { className: "h-2 w-2 shrink-0 rounded-full bg-accent", "aria-hidden": "true" }), "Kartar CUP"] }));
}
/** Header sign-in: a real, working "Continue with Google" entry point on every page (not just the
 * hero), per R28 — still contextual/on-demand, never a page-wide gate. Same in-app-browser and
 * popup-error handling as the hero's own CTA, condensed for the header. This is the header's
 * general button with no other task to continue, so a successful sign-in here lands on /profile
 * (R31) — unlike the hero's quiz CTA or a booking checkout's sign-in, which stay in place (R28). */
export function useSignInToProfile() {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const navigate = useNavigate();
    const start = async () => {
        setErr('');
        setBusy(true);
        try {
            await signInGoogle();
            navigate('/profile');
        }
        catch (e) {
            setErr(signInError(e));
        }
        finally {
            setBusy(false);
        }
    };
    return { busy, err, start };
}
function HeaderSignIn() {
    const { busy, err, start } = useSignInToProfile();
    if (isInAppBrowser())
        return null; // hero's full InAppPanel is the real entry point there
    return (_jsxs("div", { className: "flex items-center gap-2", children: [err && _jsx("span", { className: "hidden text-xs text-muted sm:inline", children: err }), _jsxs("button", { type: "button", className: linkCls, disabled: busy, onClick: () => void start(), children: [_jsx(SignIn, { size: 20, weight: "regular", "aria-hidden": "true" }), busy ? 'Signing in…' : 'Sign in'] })] }));
}
const NAV_LINKS = [
    { to: '/', label: 'Home', end: true },
    { to: '/events', label: 'Events', end: false },
    { to: '/cup', label: 'Cup', end: false },
    { to: '/gallery', label: 'Gallery', end: false },
    { to: '/stories', label: 'Stories', end: false },
    { to: '/partners', label: 'Partners', end: false },
    { to: '/about', label: 'About', end: false },
    { to: '/contact', label: 'Contact', end: false },
];
const menuItemCls = 'flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-base text-muted transition hover:bg-raised hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-[current=page]:text-ink';
/** Below md: burger button + dropdown panel. Absolutely positioned under the header (no layout
 * shift), z-30: above page content, below the tab bar chrome (z-40) and the R40 overlay (z-100).
 * Esc / tap-outside / route change / tabbing out all close it; focus returns to the button. */
function MobileMenu({ user, isHost, ready }) {
    const [open, setOpen] = useState(false);
    const reduce = useReducedMotion();
    const { pathname } = useLocation();
    const btnRef = useRef(null);
    const wrapRef = useRef(null);
    const signIn = useSignInToProfile();
    const showSignIn = ready && !user && !isInAppBrowser();
    useEffect(() => setOpen(false), [pathname]);
    useEffect(() => {
        if (!open)
            return;
        wrapRef.current?.querySelector('#site-menu a, #site-menu button')?.focus();
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                btnRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);
    return (_jsxs("div", { ref: wrapRef, className: "md:hidden", onBlur: (e) => {
            if (open && e.relatedTarget && !wrapRef.current?.contains(e.relatedTarget))
                setOpen(false);
        }, children: [_jsx("button", { ref: btnRef, type: "button", "aria-expanded": open, "aria-controls": "site-menu", "aria-label": "Menu", onClick: () => setOpen((o) => !o), className: "-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-ink transition hover:bg-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", children: open ? _jsx(X, { size: 24, weight: "regular", "aria-hidden": "true" }) : _jsx(List, { size: 24, weight: "regular", "aria-hidden": "true" }) }), _jsx(AnimatePresence, { children: open && (_jsxs(_Fragment, { children: [_jsx("div", { "aria-hidden": "true", className: "fixed inset-0 z-20", onPointerDown: () => setOpen(false) }), _jsx(motion.div, { id: "site-menu", initial: reduce ? false : { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, exit: reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -8 }, transition: reduce ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }, className: "absolute inset-x-0 top-full z-30 mt-1 rounded-lg border border-line bg-base p-2 shadow-[0_16px_40px_rgb(0_0_0/0.5)]", children: _jsxs("nav", { "aria-label": "Site menu", children: [_jsxs("ul", { className: "m-0 list-none p-0", children: [NAV_LINKS.map((l) => (_jsx("li", { children: _jsx(NavLink, { to: l.to, end: l.end, className: menuItemCls, children: l.label }) }, l.to))), Boolean(user) && isHost === true && (_jsx("li", { children: _jsxs(Link, { to: "/host", className: menuItemCls, children: [_jsx(Gauge, { size: 20, weight: "regular", "aria-hidden": "true" }), "Host console"] }) }))] }), _jsxs("div", { className: "mt-2 border-t border-line pt-2", children: [Boolean(user) && (_jsxs(Link, { to: "/profile", className: menuItemCls, children: [_jsx(User, { size: 20, weight: "regular", "aria-hidden": "true" }), "Profile"] })), showSignIn && (_jsxs("button", { type: "button", className: menuItemCls, disabled: signIn.busy, onClick: () => void signIn.start(), children: [_jsx(SignIn, { size: 20, weight: "regular", "aria-hidden": "true" }), signIn.busy ? 'Signing in…' : 'Sign in'] })), signIn.err && _jsx("p", { role: "status", className: "px-3 py-2 text-sm text-muted", children: signIn.err })] })] }) })] })) })] }));
}
/** Page shell. Left: logo placeholder linking home. Right: md+ the inline nav (Events, Gallery,
 * Host console for hosts, Profile, Sign out / Sign in); below md a burger menu (MobileMenu) holds
 * every public link plus the account actions. Sign-in works on every non-bare page (R28:
 * on-demand, not a gate). */
export function Shell({ children, bare = false }) {
    const { ready, user, isHost } = useAuth();
    return (_jsxs("div", { className: "mx-auto flex min-h-[100dvh] w-full max-w-[87.5rem] flex-col px-6 pt-4 md:px-10 md:pt-6 lg:px-16", children: [_jsxs("main", { className: "flex min-w-0 flex-1 flex-col pb-10 md:pb-12", children: [_jsxs("div", { className: "relative mb-6 flex min-h-11 items-center justify-between gap-4 md:mb-2", children: [bare ? _jsx("span", {}) : _jsx(LogoMark, {}), !bare && _jsx(MobileMenu, { user: user, isHost: isHost, ready: ready }), _jsxs("div", { className: "flex items-center gap-4 max-md:hidden", children: [!bare && (_jsxs(Link, { to: "/events", className: linkCls, children: [_jsx(TicketIcon, { size: 20, weight: "regular", "aria-hidden": "true" }), "Events"] })), !bare && (_jsxs(Link, { to: "/gallery", className: linkCls, children: [_jsx(Images, { size: 20, weight: "regular", "aria-hidden": "true" }), "Gallery"] })), !bare && user && isHost === true && (_jsxs(Link, { to: "/host", className: linkCls, children: [_jsx(Gauge, { size: 20, weight: "regular", "aria-hidden": "true" }), "Host console"] })), !bare && user && (_jsxs(Link, { to: "/profile", className: linkCls, children: [_jsx(User, { size: 20, weight: "regular", "aria-hidden": "true" }), "Profile"] })), !bare && ready && !user && _jsx(HeaderSignIn, {})] })] }), children] }), !bare && _jsx(SiteFooter, {})] }));
}
const footLinkCls = '-mx-2 inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-muted transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=page]:text-ink';
const footHeadCls = 'font-mono text-xs uppercase tracking-widest text-muted';
/** Public-site footer (non-bare pages only). Sits outside <main> so it is the page's contentinfo
 * landmark. Own text wordmark only (R27). Brand + tagline, Explore links, Community/contact with
 * the real handles from src/config/contact.ts. On phones App pads the page bottom to clear the
 * fixed tab bar and race strip, so nothing here needs its own offset. */
function SiteFooter() {
    const whatsapp = safeWhatsappUrl(CONTACT.whatsappUrl);
    return (_jsxs("footer", { className: "mt-auto pt-6", children: [_jsx("div", { "aria-hidden": "true", className: "h-px w-full bg-gradient-brand opacity-60" }), _jsxs("div", { className: "grid grid-cols-2 gap-x-6 gap-y-10 py-10 md:grid-cols-[1.3fr_1.5fr_1fr] md:gap-x-12 md:py-14", children: [_jsxs("div", { className: "col-span-2 max-w-sm md:col-span-1", children: [_jsxs("p", { className: "inline-flex items-center gap-2 text-base font-semibold tracking-tight text-ink", children: [_jsx("span", { className: "h-2 w-2 shrink-0 rounded-full bg-accent", "aria-hidden": "true" }), "Kartar CUP"] }), _jsx("p", { className: "mt-3 text-sm leading-relaxed text-muted", children: "Karting events and sim racing. Watch parties with The Karter Club." })] }), _jsxs("nav", { "aria-labelledby": "foot-explore", className: "min-w-0", children: [_jsx("h2", { id: "foot-explore", className: footHeadCls, children: "Explore" }), _jsx("ul", { className: "m-0 mt-2 list-none p-0 md:grid md:grid-cols-2 md:gap-x-8", children: NAV_LINKS.map((l) => (_jsx("li", { children: _jsx(NavLink, { to: l.to, end: l.end, className: footLinkCls, children: l.label }) }, l.to))) })] }), _jsxs("div", { className: "min-w-0", children: [_jsx("h2", { className: footHeadCls, children: "Community" }), _jsxs("ul", { "aria-label": "Community and contact", className: "m-0 mt-2 list-none p-0", children: [CONTACT.instagram.map((i) => (_jsx("li", { children: _jsxs("a", { href: i.url, target: "_blank", rel: "noopener noreferrer", className: `${footLinkCls} break-all`, children: [i.handle, _jsx("span", { className: "sr-only", children: " on Instagram (opens in a new tab)" })] }) }, i.handle))), whatsapp && (_jsx("li", { children: _jsxs("a", { href: whatsapp, target: "_blank", rel: "noopener noreferrer", className: footLinkCls, children: ["WhatsApp", _jsx("span", { className: "sr-only", children: " community (opens in a new tab)" })] }) })), _jsx("li", { children: _jsx(Link, { to: "/contact", className: footLinkCls, children: "Get in touch" }) })] })] })] }), _jsxs("div", { className: "flex flex-col gap-3 border-t border-line py-5 text-xs leading-relaxed text-muted md:flex-row md:items-start md:justify-between", children: [_jsxs("div", { className: "grid gap-1", children: [_jsxs("p", { children: ["Site design and software \u00A9 ", DEVELOPER.year, " ", DEVELOPER.name, ". All rights reserved."] }), _jsxs("p", { children: ["Operated by ", OPERATOR.legalName.trim() || OPERATOR.shortName, ", not by ", DEVELOPER.name, ". The Karter Club is an initiative by The Karter Cup. Independent fan site, not affiliated with Formula 1, its teams or drivers."] })] }), _jsxs("nav", { "aria-label": "Legal", className: "flex gap-4", children: [_jsx(Link, { to: "/terms", className: footLinkCls, children: "Terms" }), _jsx(Link, { to: "/privacy", className: footLinkCls, children: "Privacy" })] })] })] }));
}
/** Only for the home page's single true hero `<h1>The Karter Cup</h1>`. */
export const H1 = 'text-hero font-semibold text-balance';
/** Section headings within a page (e.g. the home page's SectionHeading). */
export const H2 = 'text-h2 font-semibold text-balance';
/** The top-of-page title on every other page/view (Events, Gallery, Profile, the quiz flow, etc). */
export const PageTitle = 'text-h2 font-semibold text-balance';
/** Split composition: stacked on phones, two columns from md. Left = readout, right = active step. */
export function Split({ left, right }) {
    return (_jsxs("div", { className: "grid flex-1 content-start gap-10 md:grid-cols-2 md:content-center md:items-start md:gap-14 lg:grid-cols-[1.15fr_1fr] lg:gap-24", children: [_jsx("div", { className: "flex min-w-0 flex-col", children: left }), _jsx("div", { className: "flex min-w-0 flex-col", children: right })] }));
}
export function Eyebrow({ children }) {
    return (_jsx("p", { className: "font-mono text-xs uppercase tracking-widest text-muted", children: children }));
}
export function WhatsAppCta({ url }) {
    const href = safeWhatsappUrl(url);
    if (!href)
        return null;
    return (_jsxs("a", { href: href, target: "_blank", rel: "noopener noreferrer", className: "inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-line bg-raised px-5 text-[1rem] font-medium text-ink transition duration-150 hover:border-muted active:translate-y-px active:scale-[0.98]", children: [_jsx(WhatsappLogo, { size: 22, weight: "regular", "aria-hidden": "true" }), "Join The Karter Cup WhatsApp community"] }));
}
/** Slim mono "Picks close in mm:ss" line for the open window. */
export function CloseTimer({ closesAt, className = '' }) {
    const { totalMs } = useCountdown(closesAt);
    return (_jsxs("p", { className: `flex items-baseline gap-2 font-mono text-xs uppercase tracking-widest text-muted ${className}`, children: [_jsx("span", { children: "Picks close in" }), _jsx("span", { role: "timer", className: "text-sm tabular-nums text-ink", children: formatRemaining(totalMs) })] }));
}
export function PicksList({ config, answers }) {
    return (_jsx("ol", { className: "m-0 list-none p-0", children: config.questions.map((q, i) => (_jsxs("li", { children: [i > 0 && _jsx(Divider, {}), _jsxs("div", { className: "py-4", children: [_jsxs("p", { className: "text-sm text-muted", children: [_jsx("span", { className: "font-mono tabular-nums", children: i + 1 }), ". ", q.prompt] }), _jsx("p", { className: "mt-1 text-lg font-medium text-ink", children: optionLabel(config, q, answers[q.id]) })] })] }, q.id))) }));
}
export function TickStrip({ config, ticks }) {
    const reduce = useReducedMotion();
    return (_jsx("ul", { className: "m-0 flex list-none flex-wrap gap-2 p-0", "aria-label": "Correct answers", children: config.questions.map((q, i) => (_jsxs(motion.li, { initial: reduce ? false : { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 }, transition: { ...SPRING, delay: reduce ? 0 : 0.4 + i * 0.08 }, className: `flex size-11 items-center justify-center rounded-lg border font-mono text-sm ${ticks[q.id] ? 'border-accent bg-accent text-accent-ink' : 'border-line text-muted'}`, children: [_jsxs("span", { className: "sr-only", children: ["Question ", i + 1, ": ", ticks[q.id] ? 'correct' : 'missed'] }), ticks[q.id] ? (_jsx(Check, { size: 20, weight: "regular", "aria-hidden": "true" })) : (_jsx(X, { size: 20, weight: "regular", "aria-hidden": "true" }))] }, q.id))) }));
}
