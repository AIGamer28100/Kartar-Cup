import { joinPath, type Role } from './roles';

/** Pure helpers for the user-management page and invite panel (no Firebase, so they are unit tested). */

export interface UserLike {
  uid: string;
  email: string;
  name: string;
  roles: string[];
}

/** Case-insensitive match on name or email, then optional role filter ('' = everyone, 'none' = no roles). */
export function filterUsers<T extends UserLike>(users: readonly T[], search: string, role: Role | 'none' | ''): T[] {
  const q = search.trim().toLowerCase();
  return users.filter((u) => {
    if (role === 'none' ? u.roles.length > 0 : role && !u.roles.includes(role)) return false;
    return !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });
}

/** True when this change would remove the signed-in person's own last admin capability. A super
 * admin always keeps theirs (it lives in the console, not in roles). The rules refuse self-edits
 * anyway; this lets the UI say why before trying. */
export function removesOwnLastAdmin(opts: {
  isSelf: boolean;
  isSuperAdmin: boolean;
  before: readonly string[];
  after: readonly string[];
}): boolean {
  if (!opts.isSelf || opts.isSuperAdmin) return false;
  return opts.before.includes('admin') && !opts.after.includes('admin');
}

export type InviteStatus = 'active' | 'expired' | 'revoked';

export interface InviteLike {
  active: boolean;
  expiresAt: { toMillis(): number };
}

/** Invite links are reusable until they expire or are revoked. The data has no single-use or use
 * counter, so there is deliberately no 'used' state. */
export function inviteStatus(inv: InviteLike, now: number): InviteStatus {
  if (!inv.active) return 'revoked';
  if (inv.expiresAt.toMillis() <= now) return 'expired';
  return 'active';
}

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  active: 'Active',
  expired: 'Expired',
  revoked: 'Revoked',
};

export const inviteLink = (origin: string, token: string): string => `${origin}${joinPath(token)}`;
