import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Check } from '@phosphor-icons/react';
import Button from '../components/Button';
import { RowsSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { ROLES, grantableRoles, roleLabel, toggleRole } from '../lib/roles';
import { filterUsers, removesOwnLastAdmin } from '../lib/userAdmin';
import { setUserRoles, watchAllUsers } from '../lib/users';
import InvitePanel from './InvitePanel';
import { fmtLocal } from './settings/time';
const inputCls = 'min-h-12 w-full rounded-lg border border-line bg-raised px-4 text-[1rem] text-ink placeholder:text-muted focus:border-accent';
const chipCls = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50';
function Avatar({ u }) {
    const [broken, setBroken] = useState(false);
    if (u.photoURL && !broken)
        return (_jsx("img", { src: u.photoURL, alt: "", referrerPolicy: "no-referrer", onError: () => setBroken(true), className: "size-10 shrink-0 rounded-full border border-line object-cover" }));
    return (_jsx("span", { "aria-hidden": "true", className: "flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised font-mono text-sm text-muted", children: (u.name || u.email).slice(0, 1).toUpperCase() }));
}
function UserRow({ u, isSelf }) {
    const { access } = useAuth();
    const grantable = access ? grantableRoles(access) : [];
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [confirm, setConfirm] = useState(null);
    // Own record is read-only: the rules refuse self-edits, which also keeps the last admin in place.
    const readOnly = isSelf;
    const apply = async (p) => {
        if (!access)
            return;
        const next = toggleRole(u.roles, p.role, p.on);
        if (removesOwnLastAdmin({ isSelf, isSuperAdmin: access.isSuperAdmin, before: u.roles, after: next })) {
            setErr('You cannot remove your own admin role. Ask another admin.');
            return;
        }
        setErr('');
        setConfirm(null);
        setBusy(true);
        try {
            await setUserRoles(u, next);
        }
        catch (e) {
            setErr(e.code === 'permission-denied'
                ? 'The server refused this change for your account.'
                : 'Could not save the change. Check your signal and try again.');
        }
        finally {
            setBusy(false);
        }
    };
    const onChip = (role) => {
        const on = !u.roles.includes(role);
        if (on)
            void apply({ role, on });
        else
            setConfirm({ role, on });
    };
    return (_jsxs("li", { className: "py-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx(Avatar, { u: u }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("p", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "truncate font-medium text-ink", children: u.name || 'No name' }), isSelf && (_jsxs("span", { className: "rounded border border-line px-2 py-0.5 text-xs text-muted", children: ["You", access?.isSuperAdmin ? ' (Super admin)' : ''] }))] }), _jsx("p", { className: "truncate text-sm text-muted", children: u.email }), u.lastSeenAt && (_jsxs("p", { className: "font-mono text-xs text-muted", children: ["Last seen ", fmtLocal(u.lastSeenAt.toMillis())] }))] })] }), _jsxs("ul", { className: "mt-3 flex flex-wrap gap-2", "aria-label": `Roles for ${u.name || u.email}`, children: [ROLES.map((r) => {
                        const has = u.roles.includes(r.id);
                        const canEdit = !readOnly && grantable.includes(r.id);
                        if (!canEdit && !has)
                            return null;
                        return (_jsx("li", { children: _jsxs("button", { type: "button", "aria-pressed": has, disabled: busy || !canEdit, title: r.blurb, onClick: () => onChip(r.id), className: `${chipCls} ${has ? 'border-accent text-ink' : 'border-line text-muted hover:text-ink'}`, children: [has && _jsx(Check, { size: 16, weight: "bold", "aria-hidden": "true" }), r.label, has && _jsx("span", { className: "sr-only", children: " (on)" })] }) }, r.id));
                    }), !u.roles.length && readOnly && _jsx("li", { className: "text-sm text-muted", children: "No roles" })] }), readOnly && access?.isSuperAdmin && (_jsx("p", { className: "mt-2 text-sm text-muted", children: "Super admin is set in the Firebase console and cannot be edited here." })), confirm && (_jsxs("div", { role: "alertdialog", "aria-label": "Confirm removing role", className: "mt-3 grid gap-3 border-l-2 border-accent pl-4", children: [_jsxs("p", { children: ["Remove ", roleLabel(confirm.role), " from ", u.name || u.email, "?"] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { className: "min-h-11", disabled: busy, onClick: () => void apply(confirm), children: "Remove role" }), _jsx(Button, { variant: "secondary", className: "min-h-11", onClick: () => setConfirm(null), children: "Keep it" })] })] })), busy && (_jsx("p", { role: "status", className: "mt-2 text-sm text-muted", children: "Saving..." })), err && (_jsx("p", { role: "alert", className: "mt-2 text-sm text-accent-text", children: err }))] }));
}
function UserList() {
    const { user } = useAuth();
    const [users, setUsers] = useState(null);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('');
    useEffect(() => watchAllUsers((u) => {
        setError('');
        setUsers(u);
    }, (e) => {
        setError(e.code === 'permission-denied' ? 'denied' : 'failed');
        setUsers([]);
    }), []);
    const shown = useMemo(() => (users ? filterUsers(users, search, role) : []), [users, search, role]);
    return (_jsxs("section", { "aria-label": "People", className: "py-6", children: [_jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: "People" }), _jsx("p", { className: "mt-1 max-w-2xl text-muted", children: "Everyone who has signed in. Turn roles on or off for each person. Only a super admin can make someone an admin." }), _jsxs("div", { className: "mt-6 grid max-w-2xl gap-3 sm:grid-cols-[1fr_14rem]", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "u-search", className: "text-sm text-muted", children: "Search name or email" }), _jsx("input", { id: "u-search", type: "search", className: `${inputCls} mt-1`, value: search, onChange: (e) => setSearch(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "u-role", className: "text-sm text-muted", children: "Role" }), _jsxs("select", { id: "u-role", className: `${inputCls} mt-1`, value: role, onChange: (e) => setRole(e.target.value), children: [_jsx("option", { value: "", children: "Everyone" }), _jsx("option", { value: "none", children: "No role" }), ROLES.map((r) => (_jsx("option", { value: r.id, children: r.label }, r.id)))] })] })] }), users === null ? (_jsx(RowsSkeleton, {})) : error === 'denied' ? (_jsx("p", { role: "alert", className: "mt-6 text-accent-text", children: "Your account is not allowed to list people." })) : error ? (_jsx("p", { role: "alert", className: "mt-6 text-accent-text", children: "Couldn\u2019t load people. Try refreshing." })) : shown.length === 0 ? (_jsx("p", { className: "mt-6 text-muted", children: users.length ? 'No one matches that search.' : 'No one has signed in yet.' })) : (_jsxs(_Fragment, { children: [_jsxs("p", { role: "status", className: "mt-4 font-mono text-sm text-muted", children: [shown.length, " of ", users.length] }), _jsx("ul", { className: "mt-2 divide-y divide-line border-y border-line", children: shown.map((u) => (_jsx(UserRow, { u: u, isSelf: u.uid === user?.uid }, u.uid))) })] }))] }));
}
export { UserList };
/** Host-area page: admins manage people and roles; hosts get the invite panel only (the rules
 * let any host mint community links but only admins list everyone). */
export default function UsersAdmin() {
    const { access } = useAuth();
    return (_jsxs(_Fragment, { children: [access?.isAdmin ? (_jsx(UserList, {})) : (_jsxs("section", { "aria-label": "People", className: "py-6", children: [_jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: "People" }), _jsx("p", { className: "mt-1 text-muted", children: "Only admins can see the full list of people. You can still invite people below." })] })), _jsx(InvitePanel, {})] }));
}
