import { Timestamp, collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, } from 'firebase/firestore';
import { logAudit } from './audit';
import { auth, db } from './firebase';
import { newInviteToken } from './roles';
const userRef = (uid) => doc(db, 'users', uid);
const inviteRef = (token) => doc(db, 'invites', token);
const SIX_HOURS = 6 * 3_600_000;
/** Creates the signed-in person's own record on first sign-in (no roles; rules force that), and
 * on later visits refreshes name/photo/last-seen at most every few hours to avoid a write per page. */
export async function ensureUserDoc(user) {
    const email = user.email?.toLowerCase();
    if (!email)
        return;
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
    const last = snap.data().lastSeenAt?.toMillis?.() ?? 0;
    if (Date.now() - last > SIX_HOURS) {
        await updateDoc(userRef(user.uid), { name, ...(photoURL ? { photoURL } : {}), lastSeenAt: serverTimestamp() });
    }
}
export function watchOwnUser(uid, cb, onErr) {
    return onSnapshot(userRef(uid), (s) => cb(s.exists() ? s.data() : null), onErr);
}
/** Admin-only (rules): the whole directory, newest first. */
export function watchAllUsers(cb, onErr, max = 500) {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(q, (s) => cb(s.docs.map((d) => d.data())), onErr);
}
export async function setUserRoles(target, roles) {
    const by = auth.currentUser?.email?.toLowerCase();
    if (!by)
        throw new Error('Not signed in.');
    await updateDoc(userRef(target.uid), { roles, roleUpdatedBy: by, roleUpdatedAt: serverTimestamp() });
    logAudit('user.roles', target.email, roles.length ? roles.join(', ') : 'no roles');
}
/* ---------- invite links ---------- */
export async function createInvite(role, days, note) {
    const by = auth.currentUser?.email?.toLowerCase();
    if (!by)
        throw new Error('Not signed in.');
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
export function watchInvites(cb, onErr, max = 50) {
    const q = query(collection(db, 'invites'), orderBy('createdAt', 'desc'), limit(max));
    return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...d.data(), token: d.id }))), onErr);
}
export async function revokeInvite(token) {
    await updateDoc(inviteRef(token), { active: false });
    logAudit('invite.revoke', 'invite', token.slice(0, 6) + '…');
}
export async function getInvite(token) {
    const s = await getDoc(inviteRef(token));
    return s.exists() ? { ...s.data(), token: s.id } : null;
}
/** Adds the invite's role to the signed-in person. The rules re-check everything server-side. */
export async function redeemInvite(uid, invite, currentRoles) {
    const roles = currentRoles.includes(invite.role) ? currentRoles : [...currentRoles, invite.role];
    await updateDoc(userRef(uid), { roles, joinedVia: invite.token });
}
