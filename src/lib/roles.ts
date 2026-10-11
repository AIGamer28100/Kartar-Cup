import { randomToken } from './token';
/** Roles and what they unlock. This file is the single place that says what a role can do in the
 * UI; firestore.rules enforces the same thing server-side (the UI only hides what the rules would
 * refuse anyway). To give a role more power, change it here AND in the matching rules function. */

export type Role =
  | 'admin'
  | 'host'
  | 'venue_host'
  | 'contributor'
  | 'community_member'
  | 'marketing'
  | 'social_admin';

export interface RoleInfo {
  id: Role;
  label: string;
  /** Plain-English line shown next to the role so nobody has to guess what it does. */
  blurb: string;
  /** Can be granted by an invite link (never host or admin). */
  link: boolean;
}

export const ROLES: RoleInfo[] = [
  { id: 'admin', label: 'Admin', blurb: 'Everything a host can do, plus managing people and roles, releasing part of a booking and setting the refund cutoff (only a super admin can grant this).', link: false },
  { id: 'host', label: 'Host', blurb: 'Runs the site: quiz settings, results, big screen, bookings, check-in, activity. Can cancel a booking and refund it, but not release part of one.', link: false },
  { id: 'venue_host', label: 'Venue host', blurb: 'Runs tickets and door check-in only, not the quiz. Cannot cancel a booking or give any refund.', link: true },
  { id: 'marketing', label: 'Marketing', blurb: 'Label for now: no extra access yet.', link: true },
  { id: 'social_admin', label: 'Social admin', blurb: 'Label for now: no extra access yet.', link: true },
  { id: 'contributor', label: 'Contributor', blurb: 'Label for now: no extra access yet.', link: true },
  { id: 'community_member', label: 'Community member', blurb: 'Joined through a host’s link. No extra access, but listed as part of the community.', link: true },
];

export const ROLE_IDS: Role[] = ROLES.map((r) => r.id);
export const roleLabel = (id: string): string => ROLES.find((r) => r.id === id)?.label ?? id;
const isRole = (s: string): s is Role => (ROLE_IDS as string[]).includes(s);

export interface Access {
  /** Console-created hosts/{email} entry: full access, cannot be changed from the app. */
  isSuperAdmin: boolean;
  isAdmin: boolean;
  /** Quiz, results, big screen, activity, invites. */
  isHost: boolean;
  /** Bookings admin and door check-in. */
  canRunBookings: boolean;
  /** R54: may cancel a booking and issue a refund. Host and above; never venue_host. */
  canRefund: boolean;
  /** R55: may release PART of a booking's seats. Admin and super admin only. */
  canPartialRelease: boolean;
  /** R56: may change the refund cutoff. Admin and super admin only. */
  canEditRefundPolicy: boolean;
  /** May enter the host area at all. */
  isStaff: boolean;
  roles: Role[];
}

export function accessFor(isSuperAdmin: boolean, rawRoles: readonly string[]): Access {
  const roles = rawRoles.filter(isRole);
  const has = (r: Role) => roles.includes(r);
  const isAdmin = isSuperAdmin || has('admin');
  const isHost = isAdmin || has('host');
  const canRunBookings = isHost || has('venue_host');
  // Deliberately separate fields even where they equal an existing flag: the capability is the
  // contract, so a future change to isHost/isAdmin cannot silently widen who may refund (R54-R56).
  const canRefund = isHost;
  const canPartialRelease = isAdmin;
  const canEditRefundPolicy = isAdmin;
  return {
    isSuperAdmin, isAdmin, isHost, canRunBookings, canRefund, canPartialRelease, canEditRefundPolicy,
    isStaff: canRunBookings, roles,
  };
}

/** Roles this person may put on someone else. Only a super admin may touch 'admin'. */
export function grantableRoles(a: Access): Role[] {
  if (!a.isAdmin) return [];
  return ROLE_IDS.filter((r) => r !== 'admin' || a.isSuperAdmin);
}

/** Roles this person may mint an invite link for: hosts only community_member, admins any link role. */
export function inviteRolesFor(a: Access): Role[] {
  if (!a.isHost) return [];
  const linkRoles = ROLES.filter((r) => r.link).map((r) => r.id);
  return a.isAdmin ? linkRoles : linkRoles.filter((r) => r === 'community_member');
}

/** Roles to store after toggling `role` on/off for a person, preserving the rest and the canonical order. */
export function toggleRole(current: readonly string[], role: Role, on: boolean): Role[] {
  const set = new Set(current.filter(isRole));
  if (on) set.add(role);
  else set.delete(role);
  return ROLE_IDS.filter((r) => set.has(r));
}

/** An unguessable invite token: 32 chars of base62 from the browser's secure RNG (~190 bits). The
 * link is the secret, so this must never be Math.random. */
export function newInviteToken(): string {
  return randomToken(32);
}

export const INVITE_DAY_OPTIONS = [1, 7, 30, 90] as const;
export const joinPath = (token: string) => `/join/${token}`;
