import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ArrowRight, Copy } from '@phosphor-icons/react';
import Button from '../components/Button';
import Divider from '../components/Divider';
import { isInAppBrowser } from '../lib/inAppBrowser';
import { Eyebrow, PageTitle, Reveal, Shell, Split } from './parts';
export const PHONE_RE = /^[0-9+ ]{7,16}$/;
/** Display name from the Google account (falls back to the email local part). */
export const accountName = (u) => (u.displayName?.trim() || u.email?.split('@')[0] || 'Driver').slice(0, 60);
const inputCls = 'min-h-12 w-full rounded-lg border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-muted focus:border-accent';
const focusCls = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';
export function signInError(e) {
    const code = e.code ?? '';
    if (code === 'auth/popup-blocked')
        return 'Your browser blocked the Google window. Allow pop-ups for this site, then try again.';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request')
        return 'The Google window was closed before finishing. Try again when you are ready.';
    return 'Google sign-in did not go through. Check your signal and try again.';
}
function InAppPanel() {
    const [copied, setCopied] = useState('');
    const url = window.location.href;
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied('yes');
        }
        catch {
            setCopied('manual');
        }
    };
    return (_jsxs("div", { className: "border-l-2 border-accent pl-4", role: "group", "aria-labelledby": "iab-h", children: [_jsx("h2", { id: "iab-h", className: "text-xl font-semibold tracking-tight", children: "Open in Chrome or Safari to sign in" }), _jsx("p", { className: "mt-2 text-muted", children: "This in-app browser blocks Google sign-in. Open the page in your normal browser, then sign in there." }), _jsxs("ol", { className: "mt-3 list-decimal pl-5 text-sm text-muted", children: [_jsx("li", { children: "Tap the three-dot menu or the share icon at the top or bottom." }), _jsx("li", { children: "Choose Open in browser, Open in Chrome or Open in Safari." }), _jsx("li", { children: "Or copy the link below and paste it into your browser." })] }), _jsxs(Button, { variant: "secondary", className: `mt-4 w-full ${focusCls}`, onClick: () => void copy(), children: [_jsx(Copy, { size: 20, weight: "regular", "aria-hidden": "true" }), "Copy link"] }), _jsx("p", { role: "status", className: "mt-2 text-sm text-muted", children: copied === 'yes' && 'Link copied. Paste it into Chrome or Safari.' }), copied === 'manual' && (_jsx("input", { readOnly: true, "aria-label": "Page link", className: `${inputCls} mt-2 font-mono text-sm`, value: url, onFocus: (e) => e.currentTarget.select(), ref: (el) => el?.select() }))] }));
}
/** Hero CTA doubling as the Google sign-in (R14: Google is the only way in). Errors and the in-app-browser panel render inline. */
export default function GoogleCta({ onGoogle }) {
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const inApp = isInAppBrowser();
    const go = async () => {
        setErr('');
        setBusy(true);
        try {
            await onGoogle();
        }
        catch (e) {
            setErr(signInError(e));
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsxs(Button, { id: "g-cta", disabled: busy, onClick: () => void go(), className: "w-full md:min-h-14", children: [busy ? 'Opening Google...' : 'Get on the grid', _jsx(ArrowRight, { size: 20, weight: "regular", "aria-hidden": "true" })] }), err && (_jsxs("p", { role: "alert", className: "text-sm text-accent-text", children: [err, ' ', _jsx("button", { type: "button", onClick: () => void go(), className: `min-h-11 font-medium underline ${focusCls}`, children: "Retry" })] })), inApp && _jsx(Divider, {}), inApp && _jsx(InAppPanel, {})] }));
}
/** Signed in with Google, no entry yet: confirm the account and optionally add a phone. */
export function Profile({ user, phone, onPhone, onContinue, onSwitch }) {
    const [phoneErr, setPhoneErr] = useState('');
    const next = () => {
        if (phone.trim() && !PHONE_RE.test(phone.trim())) {
            setPhoneErr('Digits, + and spaces only, 7 to 16 long.');
            return;
        }
        onContinue();
    };
    return (_jsx(Shell, { children: _jsx(Split, { left: _jsxs(Reveal, { children: [_jsx(Eyebrow, { children: "Driver briefing" }), _jsx("h1", { className: `mt-3 ${PageTitle}`, children: "You are on the radio" }), _jsxs("div", { className: "mt-8", children: [_jsx("p", { className: "text-sm text-muted", children: "Signed in as" }), _jsx("p", { className: "mt-1 text-xl font-semibold", children: accountName(user) }), user.email && _jsx("p", { className: "font-mono text-sm text-muted", children: user.email }), _jsx("button", { type: "button", onClick: onSwitch, className: `mt-1 min-h-11 text-sm text-muted underline ${focusCls}`, children: "Not you? Switch account" })] })] }), right: _jsxs("div", { className: "max-w-md", children: [_jsxs(Reveal, { index: 2, children: [_jsxs("label", { htmlFor: "g-phone", className: "mb-2 block text-sm font-medium", children: ["Phone ", _jsx("span", { className: "font-normal text-muted", children: "(optional)" })] }), _jsx("input", { id: "g-phone", className: `${inputCls} font-mono`, type: "tel", inputMode: "tel", autoComplete: "tel", value: phone, onChange: (e) => onPhone(e.target.value), "aria-invalid": !!phoneErr, "aria-describedby": phoneErr ? 'g-phone-err g-phone-hint' : 'g-phone-hint', placeholder: "+91 98765 43210" }), phoneErr && (_jsx("p", { id: "g-phone-err", role: "alert", className: "mt-2 text-sm text-accent-text", children: phoneErr })), _jsx("p", { id: "g-phone-hint", className: "mt-2 text-sm text-muted", children: "If you add a number, we may invite you to The Karter Cup WhatsApp community. Leave it blank to skip." })] }), _jsx(Reveal, { index: 3, className: "pt-8", children: _jsx(Button, { className: "w-full", onClick: next, children: "Continue" }) })] }) }) }));
}
