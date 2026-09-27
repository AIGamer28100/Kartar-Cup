import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { deriveStatus } from './eventStatus';
import { scoreEntry } from './scoring';
import { ALL_RACES, nextRace } from '../config/calendar';
import { buildDefaultEvent } from '../config/event';
import type { OwnEntryRow } from '../guest/profileModel';
import type {
  Answers,
  Entry,
  EventConfig,
  EventDoc,
  EventStatus,
  Override,
  Provider,
  Results,
  ResultsDoc,
} from './types';

const activeRef = () => doc(db, 'settings', 'active');
const eventRef = (id: string) => doc(db, 'events', id);
const resultsRef = (id: string) => doc(db, 'events', id, 'results', 'answers');
const entryRef = (id: string, uid: string) => doc(db, 'events', id, 'entries', uid);

/* ---------- multi-event API ---------- */

export function watchActiveEventId(cb: (id: string | null) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    activeRef(),
    (s) => {
      if (!s.exists() && s.metadata.fromCache) return; // offline + empty cache = unknown, not "no event"
      cb(s.exists() ? ((s.data() as { eventId?: string }).eventId ?? null) : null);
    },
    onErr,
  );
}

export function watchEventConfig(
  id: string,
  cb: (c: EventConfig | null) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    eventRef(id),
    (s) => {
      if (!s.exists() && s.metadata.fromCache) return; // offline + empty cache = unknown
      cb(s.exists() ? (s.data() as EventConfig) : null);
    },
    onErr,
  );
}

export async function getActiveEventId(): Promise<string | null> {
  const s = await getDoc(activeRef());
  return s.exists() ? ((s.data() as { eventId?: string }).eventId ?? null) : null;
}

export async function saveEventConfig(config: EventConfig): Promise<void> {
  await setDoc(eventRef(config.id), { ...config, updatedAt: serverTimestamp() });
}

export async function setActiveEvent(eventId: string): Promise<void> {
  await setDoc(activeRef(), { eventId });
}

export async function setOverride(eventId: string, override: Override): Promise<void> {
  await updateDoc(eventRef(eventId), { override, updatedAt: serverTimestamp() });
}

export async function extendCloses(eventId: string, minutes: number): Promise<void> {
  const s = await getDoc(eventRef(eventId));
  if (!s.exists()) throw new Error('Event not found');
  const cur = (s.data() as EventConfig).closesAt.toMillis();
  await updateDoc(eventRef(eventId), {
    closesAt: Timestamp.fromMillis(cur + minutes * 60_000),
    updatedAt: serverTimestamp(),
  });
}

/** Subscribe to something under the active event, re-subscribing when the active event changes. */
function watchUnderActive(
  inner: (id: string) => Unsubscribe,
  onNone: () => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  let innerUnsub: Unsubscribe | null = null;
  let current: string | null | undefined;
  const outer = watchActiveEventId((id) => {
    if (id === current) return;
    current = id;
    innerUnsub?.();
    innerUnsub = null;
    if (id) innerUnsub = inner(id);
    else onNone();
  }, onErr);
  return () => {
    outer();
    innerUnsub?.();
  };
}

/* ---------- legacy wrappers over the active event ---------- */

function toLegacy(c: EventConfig, nowMs: number): EventDoc {
  const s = deriveStatus(c, nowMs);
  return {
    status: s === 'scored' ? 'scored' : s === 'open' ? 'open' : 'locked',
    lightsOutUtc: c.closesAt, // legacy consumers treat this as the moment picks lock
    winnerRevealed: c.winnerRevealed,
    tiebreakOverride: c.tiebreakOverride,
  };
}

export function watchEvent(cb: (e: EventDoc | null) => void, onErr?: (e: Error) => void): Unsubscribe {
  let cfg: EventConfig | null = null;
  let last: string | null = null;
  const emit = () => {
    const e = cfg ? toLegacy(cfg, Date.now()) : null;
    const key = e ? `${e.status}|${e.lightsOutUtc.toMillis()}|${e.winnerRevealed}|${e.tiebreakOverride}` : 'null';
    if (key === last) return;
    last = key;
    cb(e);
  };
  const timer = setInterval(emit, 1000);
  const unsub = watchUnderActive(
    (id) =>
      watchEventConfig(
        id,
        (c) => {
          cfg = c;
          emit();
        },
        onErr,
      ),
    () => {
      cfg = null;
      emit();
    },
    onErr,
  );
  return () => {
    clearInterval(timer);
    unsub();
  };
}

export function watchOwnEntry(
  uid: string,
  cb: (e: Entry | null, pending: boolean) => void,
): Unsubscribe {
  return watchUnderActive(
    (id) =>
      onSnapshot(entryRef(id, uid), { includeMetadataChanges: true }, (s) =>
        cb(
          s.exists() ? ({ ...s.data({ serverTimestamps: 'estimate' }), uid: s.id } as Entry) : null,
          s.metadata.hasPendingWrites,
        ),
      ),
    () => cb(null, false),
  );
}

export interface SubmitEntryInput {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  provider: Provider;
  answers: Answers;
}

async function requireActive(): Promise<string> {
  const id = await getActiveEventId();
  if (!id) throw new Error('No live event right now.');
  return id;
}

export async function submitEntry(input: SubmitEntryInput, isFirst: boolean): Promise<void> {
  const id = await requireActive();
  const { uid, name, email, phone, provider, answers } = input;
  const data: Record<string, unknown> = { uid, name, email, provider, answers };
  if (phone !== undefined) data.phone = phone;
  if (isFirst) {
    await setDoc(entryRef(id, uid), {
      ...data,
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    });
  } else {
    await setDoc(entryRef(id, uid), { ...data, submittedAt: serverTimestamp() }, { merge: true });
  }
}

export function watchResults(
  cb: (r: ResultsDoc | null) => void,
  onErr?: (err: Error) => void,
): Unsubscribe {
  return watchUnderActive(
    (id) => onSnapshot(resultsRef(id), (s) => cb(s.exists() ? (s.data() as ResultsDoc) : null), onErr),
    () => cb(null),
    onErr,
  );
}

export function watchEntries(cb: (e: Entry[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return watchUnderActive(
    (id) =>
      onSnapshot(
        collection(db, 'events', id, 'entries'),
        (s) => cb(s.docs.map((d) => ({ ...d.data({ serverTimestamps: 'estimate' }), uid: d.id }) as Entry)),
        onErr,
      ),
    () => cb([]),
    onErr,
  );
}

/** Guest's own quiz history across ALL events (R15/R31: own uid only). `events/*` is publicly
 * readable (list) so we can enumerate event ids, then `get` each `entries/{uid}` doc directly —
 * a per-uid `get`, never a cross-user `list`, exactly what the entries rule allows a non-host to
 * do. Score stays null until the host reveals the winner and publishes results for that event
 * (results are only readable once `winnerRevealed`). */
export async function listOwnEntries(uid: string): Promise<OwnEntryRow[]> {
  const eventsSnap = await getDocs(collection(db, 'events'));
  const rows = await Promise.all(
    eventsSnap.docs.map(async (ed): Promise<OwnEntryRow | null> => {
      const config = ed.data() as EventConfig;
      const entrySnap = await getDoc(entryRef(ed.id, uid));
      if (!entrySnap.exists()) return null;
      const entry = entrySnap.data() as Entry;
      let score: number | null = null;
      if (config.winnerRevealed) {
        const rs = await getDoc(resultsRef(ed.id));
        if (rs.exists()) {
          score = scoreEntry(entry.answers, (rs.data() as ResultsDoc).answers, config.questionIds).score;
        }
      }
      return {
        eventId: ed.id,
        eventName: config.name,
        submittedAtMs: entry.submittedAt.toMillis(),
        score,
      };
    }),
  );
  return rows.filter((r): r is OwnEntryRow => r !== null);
}

export async function isHost(email: string): Promise<boolean> {
  const s = await getDoc(doc(db, 'hosts', email.toLowerCase()));
  return s.exists();
}

/** Legacy: create the first event (next calendar race), open now, picks lock at the given time; make it active. */
export async function initEvent(lightsOutIso: string): Promise<void> {
  if (await getActiveEventId()) return;
  const race = nextRace(new Date(), ALL_RACES) ?? ALL_RACES[0];
  const { config: base } = await buildDefaultEvent(race);
  const nowMs = Date.now();
  const config: EventConfig = {
    ...base,
    raceStartUtc: Timestamp.fromMillis(nowMs),
    opensAt: Timestamp.fromMillis(nowMs),
    closesAt: Timestamp.fromMillis(new Date(lightsOutIso).getTime()),
  };
  await saveEventConfig(config);
  await setActiveEvent(config.id);
}

export async function setEventStatus(s: EventStatus): Promise<void> {
  const id = await requireActive();
  if (s === 'scored') await updateDoc(eventRef(id), { winnerRevealed: true });
  else await setOverride(id, s === 'open' ? 'open' : 'closed');
}

/** Legacy: moves the moment picks lock (closesAt). */
export async function setLightsOut(iso: string): Promise<void> {
  const id = await requireActive();
  await updateDoc(eventRef(id), {
    closesAt: Timestamp.fromMillis(new Date(iso).getTime()),
    updatedAt: serverTimestamp(),
  });
}

export async function saveResults(r: Results, source: string): Promise<void> {
  const id = await requireActive();
  await setDoc(resultsRef(id), { answers: r, source, updatedAt: serverTimestamp() });
}

export async function revealWinner(overrideUid: string | null): Promise<void> {
  const id = await requireActive();
  await updateDoc(eventRef(id), { winnerRevealed: true, tiebreakOverride: overrideUid });
}
