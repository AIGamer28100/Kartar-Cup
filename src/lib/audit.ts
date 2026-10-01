import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';

/** Short, stable action names so the log stays searchable. */
export type AuditAction =
  | 'event.save'
  | 'event.go-live'
  | 'event.override'
  | 'event.extend-closes'
  | 'event.set-lights-out'
  | 'results.save'
  | 'winner.reveal'
  | 'booking-event.create'
  | 'booking-event.update'
  | 'booking.check-in';

export interface AuditRow {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail?: string;
  at: Timestamp;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Best-effort record of a host action. It is awaited by nobody and never throws: the audit trail
 * must not be able to block or fail the action it describes (a flaky write here should not stop a
 * host closing the quiz mid-event). Rules pin `actor` and `at`, so entries cannot be forged
 * or backdated, and nobody can edit or delete them afterwards.
 */
export function logAudit(action: AuditAction, target: string, detail?: string): void {
  const actor = auth.currentUser?.email?.toLowerCase();
  if (!actor) return;
  const row: Record<string, unknown> = {
    action,
    actor,
    target: clip(target, 120),
    at: serverTimestamp(),
  };
  if (detail) row.detail = clip(detail, 300);
  addDoc(collection(db, 'auditLogs'), row).catch((e: unknown) => {
    console.warn('[audit] could not record', action, e);
  });
}

/** Newest first, host-only (rules). */
export function watchAuditLog(
  cb: (rows: AuditRow[]) => void,
  onErr?: (e: Error) => void,
  max = 100,
): Unsubscribe {
  const q = query(collection(db, 'auditLogs'), orderBy('at', 'desc'), limit(max));
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ ...(d.data({ serverTimestamps: 'estimate' }) as Omit<AuditRow, 'id'>), id: d.id }))),
    onErr,
  );
}
