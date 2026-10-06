import { addDoc, collection, limit, onSnapshot, orderBy, query, serverTimestamp, } from 'firebase/firestore';
import { auth, db } from './firebase';
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
/**
 * Best-effort record of a host action. It is awaited by nobody and never throws: the audit trail
 * must not be able to block or fail the action it describes (a flaky write here should not stop a
 * host closing the quiz mid-event). Rules pin `actor` and `at`, so entries cannot be forged
 * or backdated, and nobody can edit or delete them afterwards.
 */
export function logAudit(action, target, detail) {
    const actor = auth.currentUser?.email?.toLowerCase();
    if (!actor)
        return;
    const row = {
        action,
        actor,
        target: clip(target, 120),
        at: serverTimestamp(),
    };
    if (detail)
        row.detail = clip(detail, 300);
    addDoc(collection(db, 'auditLogs'), row).catch((e) => {
        console.warn('[audit] could not record', action, e);
    });
}
/** Newest first, host-only (rules). */
export function watchAuditLog(cb, onErr, max = 100) {
    const q = query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(max));
    return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ ...d.data({ serverTimestamps: 'estimate' }), id: d.id }))), onErr);
}
