import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy } from '@phosphor-icons/react';
import Button from '../components/Button';
import Skeleton from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { INVITE_DAY_OPTIONS, ROLES, inviteRolesFor, roleLabel } from '../lib/roles';
import { INVITE_STATUS_LABEL, inviteLink, inviteStatus } from '../lib/userAdmin';
import { createInvite, revokeInvite, watchInvites } from '../lib/users';
import { fmtLocal } from './settings/time';
const inputCls = 'min-h-12 w-full rounded-lg border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-muted focus:border-accent';
const errMsg = (e, fallback) => e.code === 'permission-denied' ? 'The server refused this change for your account.' : fallback;
function LinkQr({ url }) {
    const [qr, setQr] = useState(null);
    useEffect(() => {
        let cancelled = false;
        QRCode.toDataURL(url, { margin: 1, width: 480, color: { dark: '#111', light: '#fff' } })
            .then((d) => !cancelled && setQr(d))
            .catch(() => !cancelled && setQr(null));
        return () => {
            cancelled = true;
        };
    }, [url]);
    return qr ? (_jsx("img", { src: qr, alt: "QR code for the invite link", className: "size-56 rounded-lg border border-line bg-white p-2" })) : (_jsx(Skeleton, { className: "size-56 rounded-lg" }));
}
export default function InvitePanel() {
    const { access } = useAuth();
    const roles = access ? inviteRolesFor(access) : [];
    const [role, setRole] = useState('');
    const [days, setDays] = useState(7);
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [created, setCreated] = useState(null);
    const [copied, setCopied] = useState('');
    const [invites, setInvites] = useState(null);
    const [listErr, setListErr] = useState(false);
    const [revoking, setRevoking] = useState('');
    const [revokeErr, setRevokeErr] = useState('');
    useEffect(() => watchInvites((i) => {
        setListErr(false);
        setInvites(i);
    }, () => {
        setListErr(true);
        setInvites([]);
    }), []);
    const chosen = role && roles.includes(role) ? role : (roles[0] ?? '');
    const create = async () => {
        if (!chosen)
            return;
        setErr('');
        setCopied('');
        setBusy(true);
        try {
            const token = await createInvite(chosen, days, note);
            setCreated({ url: inviteLink(window.location.origin, token), role: chosen });
            setNote('');
        }
        catch (e) {
            setErr(errMsg(e, 'Could not create the link. Check your signal and try again.'));
        }
        finally {
            setBusy(false);
        }
    };
    const copy = async () => {
        if (!created)
            return;
        try {
            await navigator.clipboard.writeText(created.url);
            setCopied('yes');
        }
        catch {
            setCopied('manual');
        }
    };
    const revoke = async (token) => {
        setRevokeErr('');
        setRevoking(token);
        try {
            await revokeInvite(token);
        }
        catch (e) {
            setRevokeErr(errMsg(e, 'Could not revoke that link. Try again.'));
        }
        finally {
            setRevoking('');
        }
    };
    if (!roles.length)
        return null;
    const blurb = ROLES.find((r) => r.id === chosen)?.blurb;
    const now = Date.now();
    return (_jsxs("section", { "aria-label": "Invite links", className: "border-t border-line py-6", children: [_jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: "Invite links" }), _jsx("p", { className: "mt-1 max-w-2xl text-muted", children: "Share a secure link or QR code. Whoever opens it, signs in with Google and taps Join gets the role. Anyone with the link can use it until it expires or you revoke it, so share it only with the people you mean." }), _jsxs("div", { className: "mt-6 grid max-w-xl gap-4", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "inv-role", className: "text-sm text-muted", children: "Role" }), _jsx("select", { id: "inv-role", className: `${inputCls} mt-1`, value: chosen, disabled: busy, onChange: (e) => setRole(e.target.value), children: roles.map((r) => (_jsx("option", { value: r, children: roleLabel(r) }, r))) }), blurb && _jsx("p", { className: "mt-1 text-sm text-muted", children: blurb })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "inv-days", className: "text-sm text-muted", children: "Link works for" }), _jsx("select", { id: "inv-days", className: `${inputCls} mt-1`, value: days, disabled: busy, onChange: (e) => setDays(Number(e.target.value)), children: INVITE_DAY_OPTIONS.map((d) => (_jsxs("option", { value: d, children: [d, " ", d === 1 ? 'day' : 'days'] }, d))) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "inv-note", className: "text-sm text-muted", children: "Note for yourself (optional)" }), _jsx("input", { id: "inv-note", className: `${inputCls} mt-1`, maxLength: 120, value: note, disabled: busy, placeholder: "Who or what this link is for", onChange: (e) => setNote(e.target.value) })] }), _jsx(Button, { disabled: busy || !chosen, onClick: () => void create(), className: "w-full sm:w-auto", children: busy ? 'Creating...' : 'Create invite link' }), err && (_jsx("p", { role: "alert", className: "text-sm text-accent-text", children: err }))] }), created && (_jsxs("div", { className: "mt-6 grid max-w-xl gap-4 border-l-2 border-accent pl-4", role: "group", "aria-label": "New invite link", children: [_jsxs("p", { className: "font-medium", children: ["New ", roleLabel(created.role), " link"] }), _jsx("input", { readOnly: true, "aria-label": "Invite link", className: `${inputCls} font-mono text-sm`, value: created.url, onFocus: (e) => e.currentTarget.select() }), _jsxs(Button, { variant: "secondary", onClick: () => void copy(), className: "w-full sm:w-auto", children: [_jsx(Copy, { size: 20, weight: "regular", "aria-hidden": "true" }), " Copy link"] }), _jsxs("p", { role: "status", className: "text-sm text-muted", children: [copied === 'yes' && 'Link copied.', copied === 'manual' && 'Copy is blocked here. Select the link above and copy it by hand.'] }), _jsx(LinkQr, { url: created.url })] })), _jsx("h3", { className: "mt-8 text-xl font-semibold", children: "Recent links" }), invites === null ? (_jsx(Skeleton, { className: "mt-3 h-16 w-full" })) : listErr ? (_jsx("p", { role: "alert", className: "mt-3 text-accent-text", children: "Couldn\u2019t load invite links. Try refreshing." })) : invites.length === 0 ? (_jsx("p", { className: "mt-3 text-muted", children: "No invite links yet." })) : (_jsx("ul", { className: "mt-3 divide-y divide-line border-y border-line", children: invites.map((i) => {
                    const st = inviteStatus(i, now);
                    return (_jsxs("li", { className: "flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3", children: [_jsxs("span", { className: "min-w-0", children: [_jsx("span", { className: "text-ink", children: roleLabel(i.role) }), _jsx("span", { className: "ml-2 rounded border border-line px-2 py-0.5 text-xs text-muted", children: INVITE_STATUS_LABEL[st] }), _jsxs("span", { className: "mt-0.5 block font-mono text-sm text-muted", children: ["Expires ", fmtLocal(i.expiresAt.toMillis()), " \u00B7 ", i.createdBy] }), i.note && _jsx("span", { className: "block truncate text-sm text-muted", children: i.note })] }), st === 'active' && (_jsx(Button, { variant: "secondary", className: "min-h-11", disabled: revoking === i.token, onClick: () => void revoke(i.token), "aria-label": `Revoke ${roleLabel(i.role)} link ending ${i.token.slice(-4)}`, children: revoking === i.token ? 'Revoking...' : 'Revoke' }))] }, i.token));
                }) })), revokeErr && (_jsx("p", { role: "alert", className: "mt-3 text-sm text-accent-text", children: revokeErr }))] }));
}
