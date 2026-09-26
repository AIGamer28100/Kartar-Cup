import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  Answers,
  Entry,
  EventDoc,
  EventStatus,
  Provider,
  Results,
  ResultsDoc,
} from './types';

const eventRef = () => doc(db, 'event', 'current');
const resultsRef = () => doc(db, 'event', 'results');
const entryRef = (uid: string) => doc(db, 'entries', uid);

export function watchEvent(cb: (e: EventDoc | null) => void): Unsubscribe {
  return onSnapshot(eventRef(), (s) => cb(s.exists() ? (s.data() as EventDoc) : null));
}

export function watchOwnEntry(
  uid: string,
  cb: (e: Entry | null, pending: boolean) => void,
): Unsubscribe {
  return onSnapshot(entryRef(uid), { includeMetadataChanges: true }, (s) =>
    cb(
      s.exists() ? ({ ...s.data({ serverTimestamps: 'estimate' }), uid: s.id } as Entry) : null,
      s.metadata.hasPendingWrites,
    ),
  );
}

export interface SubmitEntryInput {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  provider: Provider;
  answers: Answers;
}

export async function submitEntry(input: SubmitEntryInput, isFirst: boolean): Promise<void> {
  const { uid, name, email, phone, provider, answers } = input;
  const data: Record<string, unknown> = { uid, name, provider, answers };
  if (email !== undefined) data.email = email;
  if (phone !== undefined) data.phone = phone;
  if (isFirst) {
    await setDoc(entryRef(uid), {
      ...data,
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } else {
    await setDoc(entryRef(uid), { ...data, submittedAt: serverTimestamp() }, { merge: true });
  }
}

export function watchResults(
  cb: (r: ResultsDoc | null) => void,
  onErr?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(resultsRef(), (s) => cb(s.exists() ? (s.data() as ResultsDoc) : null), onErr);
}

export function watchEntries(cb: (e: Entry[]) => void): Unsubscribe {
  return onSnapshot(collection(db, 'entries'), (s) =>
    cb(s.docs.map((d) => ({ ...d.data({ serverTimestamps: 'estimate' }), uid: d.id }) as Entry)),
  );
}

export async function isHost(email: string): Promise<boolean> {
  const s = await getDoc(doc(db, 'hosts', email.toLowerCase()));
  return s.exists();
}

export async function initEvent(lightsOutIso: string): Promise<void> {
  const s = await getDoc(eventRef());
  if (s.exists()) return;
  await setDoc(eventRef(), {
    status: 'open',
    lightsOutUtc: Timestamp.fromDate(new Date(lightsOutIso)),
    winnerRevealed: false,
    tiebreakOverride: null,
  } satisfies EventDoc);
}

export async function setEventStatus(s: EventStatus): Promise<void> {
  await updateDoc(eventRef(), { status: s });
}

export async function setLightsOut(iso: string): Promise<void> {
  await updateDoc(eventRef(), { lightsOutUtc: Timestamp.fromDate(new Date(iso)) });
}

export async function saveResults(r: Results, source: string): Promise<void> {
  await setDoc(resultsRef(), { answers: r, source, updatedAt: serverTimestamp() });
}

export async function revealWinner(overrideUid: string | null): Promise<void> {
  await updateDoc(eventRef(), {
    status: 'scored',
    winnerRevealed: true,
    tiebreakOverride: overrideUid,
  });
}
