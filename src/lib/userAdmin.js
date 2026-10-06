import { joinPath } from './roles';
/** Case-insensitive match on name or email, then optional role filter ('' = everyone, 'none' = no roles). */
export function filterUsers(users, search, role) {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
        if (role === 'none' ? u.roles.length > 0 : role && !u.roles.includes(role))
            return false;
        return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
}
/** True when this change would remove the signed-in person's own last admin capability. A super
 * admin always keeps theirs (it lives in the console, not in roles). The rules refuse self-edits
 * anyway; this lets the UI say why before trying. */
export function removesOwnLastAdmin(opts) {
    if (!opts.isSelf || opts.isSuperAdmin)
        return false;
    return opts.before.includes('admin') && !opts.after.includes('admin');
}
/** Invite links are reusable until they expire or are revoked. The data has no single-use or use
 * counter, so there is deliberately no 'used' state. */
export function inviteStatus(inv, now) {
    if (!inv.active)
        return 'revoked';
    if (inv.expiresAt.toMillis() <= now)
        return 'expired';
    return 'active';
}
export const INVITE_STATUS_LABEL = {
    active: 'Active',
    expired: 'Expired',
    revoked: 'Revoked',
};
export const inviteLink = (origin, token) => `${origin}${joinPath(token)}`;
