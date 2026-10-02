import {
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { logAudit } from './audit';
import { auth, db } from './firebase';
import { newInviteToken, type Role } from './roles';

export interface UserRecord {
  uid: string;
  email: string;
  name: string;
  photoURL?: string;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
  roles: string[];
  joinedVia?: string;
  roleUpdatedBy?: string;
}

export interface Invite {
  token: string;
  role: Role;
  createdBy: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  active: boolean;
  note?: string;
}

const userRef = (uid: string) => doc(db, 'users', uid);
const inviteRef = (token: string) => doc(db, 'invites', token);
const SIX_HOURS = 6 * 3_600_000;

/** Creates the signed-in person's own record on first sign-in (no roles; rules force that), and
 * on later visits refreshes name/photo/last-seen at most every few hours to avoid a write per page. */
export async function ensureUserDoc(user: User): Promise<void> {
  const email = user.email?.toLowerCase();
  if (!email) return;
  const name = (user.displayName ?? email.split('@')[0]).slice(0, 120);
  const photoURL = user.photoURL && user.photoURL.length <= 500 ? user.photoURL : undefined;
  const snap = await getDoc(userRef(user.uid));
  if (!snap.exists()) {
    await setDoc(userRef(user.uid), {
      uid: user.uid,
      email,
      name,
      ...(photoURL ? { photoURL } : {}),
      createdAt: serverTimestamp(),
      lastSeenAt: serverTimestamp(),
      roles: [],
    });
    return;
  }
  const last = (snap.data() as UserRecord).lastSeenAt?.toMillis?.() ?? 0;
  if (Date.now() - last > SIX_HOURS) {
    await updateDoc(userRef(user.uid), { name, ...(photoURL ? { photoURL } : {}), lastSeenAt: serverTimestamp() });
  }
}

export function watchOwnUser(uid: string, cb: (u: UserRecord | null) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(userRef(uid), (s) => cb(s.exists() ? (s.data() as UserRecord) : null), onErr);
}

/** Admin-only (rules): the whole directory, newest first. */
export function watchAllUsers(cb: (u: UserRecord[]) => void, onErr?: (e: Error) => void, max = 500): Unsubscribe {
  const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data() as UserRecord)), onErr);
}

export async function setUserRoles(target: UserRecord, roles: Role[]): Promise<void> {
  const by = auth.currentUser?.email?.toLowerCase();
  if (!by) throw new Error('Not signed in.');
  await updateDoc(userRef(target.uid), { roles, roleUpdatedBy: by, roleUpdatedAt: serverTimestamp() });
  logAudit('user.roles', target.email, roles.length ? roles.join(', ') : 'no roles');
}

/* ---------- invite links ---------- */

export async function createInvite(role: Role, days: number, note?: string): Promise<string> {
  const by = auth.currentUser?.email?.toLowerCase();
  if (!by) throw new Error('Not signed in.');
  const token = newInviteToken();
  await setDoc(inviteRef(token), {
    role,
    createdBy: by,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + days * 86_400_000),
    active: true,
    ...(note?.trim() ? { note: note.trim().slice(0, 120) } : {}),
  });
  logAudit('invite.create', role, `${days} day link`);
  return token;
}

export function watchInvites(cb: (i: Invite[]) => void, onErr?: (e: Error) => void, max = 50): Unsubscribe {
  const q = query(collection(db, 'invites'), orderBy('createdAt', 'desc'), limit(max));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<Invite, 'token'>), token: d.id }))), onErr);
}

export async function revokeInvite(token: string): Promise<void> {
  await updateDoc(inviteRef(token), { active: false });
  logAudit('invite.revoke', 'invite', token.slice(0, 6) + '…');
}

export async function getInvite(token: string): Promise<Invite | null> {
  const s = await getDoc(inviteRef(token));
  return s.exists() ? { ...(s.data() as Omit<Invite, 'token'>), token: s.id } : null;
}

/** Adds the invite's role to the signed-in person. The rules re-check everything server-side. */
export async function redeemInvite(uid: string, invite: Invite, currentRoles: string[]): Promise<void> {
  const roles = currentRoles.includes(invite.role) ? currentRoles : [...currentRoles, invite.role];
  await updateDoc(userRef(uid), { roles, joinedVia: invite.token });
}
