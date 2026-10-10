import {
  Timestamp,
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { logAudit } from './audit';
import { watchBookingEvents } from './bookings';
import { db } from './firebase';
import { deriveLiveQuizId, liveQuizMode, type LiveQuizMode } from './liveQuiz';
import { clampLap, lightsOutClosesAtMs, quizEarliestOpenMs, quizLatestCloseMs } from './quizWindow';
import { pointsMap, scoreEntry } from './scoring';
import type { OwnEntryRow } from '../guest/profileModel';
import type {
  Answers,
  BookingEvent,
  Entry,
  EventConfig,
  Override,
  Provider,
  Results,
  ResultsDoc,
  ScreenState,
} from './types';

const activeRef = () => doc(db, 'settings', 'active');
const eventRef = (id: string) => doc(db, 'events', id);
const resultsRef = (id: string) => doc(db, 'events', id, 'results', 'answers');
const entryRef = (id: string, uid: string) => doc(db, 'events', id, 'entries', uid);
const screenStateRef = (id: string) => doc(db, 'events', id, 'screen', 'state');

/* ---------- multi-event API ---------- */

/** A fresh `events/` doc id. Quizzes are owned by a watch party (R57), so the id is no longer a race id. */
export const newEventId = (): string => doc(collection(db, 'events')).id;


/** The live-quiz pointer as the host console sees it: the stored mode and eventId, plus the quiz derived from the
 * running/next watch party (only computed in 'auto'; null in 'manual'). */
export interface LiveQuizSetting {
  mode: LiveQuizMode;
  eventId: string | null;
  derivedId: string | null;
}

/** How often an 'auto' pointer re-derives on its own, so it moves on to the next watch party with no event change. */
const LIVE_QUIZ_TICK_MS = 60_000;

/** Watches settings/active and, in 'auto' mode, the booking events too (re-derived on every change and every
 * 60 s). Emits only when something changed. In 'auto' the first emit waits for the booking events. */
export function watchLiveQuizSetting(cb: (s: LiveQuizSetting) => void, onErr?: (e: Error) => void): Unsubscribe {
  let mode: LiveQuizMode | null = null; // null until the first known snapshot
  let eventId: string | null = null;
  let events: BookingEvent[] | null = null;
  let stopEvents: Unsubscribe | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let last: string | null = null;
  const emit = () => {
    if (mode === null) return;
    if (mode === 'auto' && events === null) return;
    const next: LiveQuizSetting = {
      mode,
      eventId,
      derivedId: mode === 'auto' ? deriveLiveQuizId(events ?? [], Date.now()) : null,
    };
    const key = JSON.stringify(next);
    if (key === last) return;
    last = key;
    cb(next);
  };
  const stopAuto = () => {
    stopEvents?.();
    stopEvents = null;
    if (timer !== null) clearInterval(timer);
    timer = null;
    events = null;
  };
  const stopDoc = onSnapshot(
    activeRef(),
    (s) => {
      if (!s.exists() && s.metadata.fromCache) return; // offline + empty cache = unknown, not "no event"
      const d = s.exists() ? (s.data() as { eventId?: string; mode?: string }) : {};
      mode = liveQuizMode(d.mode);
      eventId = d.eventId ?? null;
      if (mode === 'auto' && !stopEvents) {
        stopEvents = watchBookingEvents((evs) => {
          events = evs;
          emit();
        }, onErr);
        timer = setInterval(emit, LIVE_QUIZ_TICK_MS);
      } else if (mode === 'manual') {
        stopAuto();
      }
      emit();
    },
    onErr,
  );
  return () => {
    stopDoc();
    stopAuto();
  };
}

/** The live quiz id, resolved by mode: 'manual' -> the stored eventId, 'auto' -> derived from the watch parties.
 * Emits only when the resolved id changes. */
export function watchActiveEventId(cb: (id: string | null) => void, onErr?: (e: Error) => void): Unsubscribe {
  let last: string | null | undefined;
  return watchLiveQuizSetting((s) => {
    const id = s.mode === 'auto' ? s.derivedId : s.eventId;
    if (id === last) return;
    last = id;
    cb(id);
  }, onErr);
}

/** One-shot server read of an event config (null when it does not exist). */
export async function getEventConfig(id: string): Promise<EventConfig | null> {
  const s = await getDoc(eventRef(id));
  return s.exists() ? (s.data() as EventConfig) : null;
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

/** One-shot read of the live quiz id, resolved by mode like watchActiveEventId. */
export async function getActiveEventId(): Promise<string | null> {
  const s = await getDoc(activeRef());
  const d = s.exists() ? (s.data() as { eventId?: string; mode?: string }) : {};
  if (liveQuizMode(d.mode) === 'manual') return d.eventId ?? null;
  const events = await new Promise<BookingEvent[]>((resolve, reject) => {
    let stop: Unsubscribe | null = null;
    let done = false;
    stop = watchBookingEvents(
      (evs) => {
        done = true;
        stop?.();
        resolve(evs);
      },
      (e) => {
        stop?.();
        reject(e);
      },
    );
    if (done) stop();
  });
  return deriveLiveQuizId(events, Date.now());
}

/** Switches the live-quiz pointer between 'manual' and 'auto'. The stored eventId is kept, so switching back
 * to manual restores the host's pick. */
export async function setLiveQuizMode(mode: LiveQuizMode): Promise<void> {
  await setDoc(activeRef(), { mode }, { merge: true });
}

/** The live quiz-clock fields are owned by the live controls, not the settings form. */
const LIVE_CLOCK_KEYS = ['raceStartedAt', 'delayed', 'liveLap'] as const;

/** Saves a full config. A transaction, so the live quiz clock (lights out, delay, lap) set from the live controls
 * meanwhile is carried over rather than wiped by a form that loaded before it. After lights out the quiz window
 * belongs to the live controls too, so the stored opensAt / closesAt are kept. */
export async function saveEventConfig(config: EventConfig): Promise<void> {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(eventRef(config.id));
    const cur = s.exists() ? (s.data() as EventConfig) : null;
    const next: Record<string, unknown> = { ...config, updatedAt: serverTimestamp() };
    for (const k of LIVE_CLOCK_KEYS) {
      delete next[k];
      if (cur && cur[k] !== undefined) next[k] = cur[k];
    }
    if (config.totalLaps === undefined) delete next.totalLaps;
    if (cur?.raceStartedAt) {
      next.opensAt = cur.opensAt;
      next.closesAt = cur.closesAt;
    }
    if (typeof next.liveLap === 'number') {
      if (config.totalLaps) next.liveLap = clampLap(next.liveLap, config.totalLaps);
      else delete next.liveLap;
    }
    tx.set(eventRef(config.id), next);
  });
  logAudit('event.save', config.id, config.name);
}

export async function setActiveEvent(eventId: string): Promise<void> {
  // Choosing a quiz by hand is a manual decision: it switches the pointer to manual so it is not
  // silently overridden by the auto-derived one.
  await setDoc(activeRef(), { eventId, mode: 'manual' }, { merge: true });
  logAudit('event.go-live', eventId);
}

export async function setOverride(eventId: string, override: Override): Promise<void> {
  // A close past the 30% cap, or an open before the 10-minute floor, is legal only while override is 'open'
  // (firestore.rules). Leaving 'open' therefore pulls those two bounds back in the same write.
  await runTransaction(db, async (tx) => {
    const s = await tx.get(eventRef(eventId));
    if (!s.exists()) throw new Error('Event not found');
    const c = s.data() as EventConfig;
    const patch: Record<string, unknown> = { override, updatedAt: serverTimestamp() };
    if (override !== 'open') {
      const cap = quizLatestCloseMs((c.raceStartedAt ?? c.raceStartUtc).toMillis(), c.raceDurationMin);
      const floor = quizEarliestOpenMs(c.raceStartUtc.toMillis());
      const closes = Math.min(c.closesAt.toMillis(), cap);
      const opens = Math.max(c.opensAt.toMillis(), floor);
      if (closes !== c.closesAt.toMillis()) patch.closesAt = Timestamp.fromMillis(closes);
      if (opens !== c.opensAt.toMillis()) patch.opensAt = Timestamp.fromMillis(opens);
      if (closes <= opens) throw new Error('This quiz was opened outside its normal window. Edit the race start in Details first.');
    }
    tx.update(eventRef(eventId), patch);
  });
  logAudit('event.override', eventId, `override=${override}`);
}

/** Moves the deadline by `minutes`, counted from the later of the stored deadline and now (so it also reopens a quiz
 * the clock already closed). Auto mode caps it at 30% of the race from the actual (else scheduled) lights out. In
 * Manual mode (`uncapped`) the host may go past that cap as often as they like: the write then also sets override
 * 'open', the only state in which firestore.rules accept a close beyond the cap. */
export async function extendCloses(eventId: string, minutes: number, uncapped = false): Promise<void> {
  // Transaction, not read-then-write: two hosts extending at once must both count, not clobber.
  await runTransaction(db, async (tx) => {
    const s = await tx.get(eventRef(eventId));
    if (!s.exists()) throw new Error('Event not found');
    const c = s.data() as EventConfig;
    const cur = c.closesAt.toMillis();
    const cap = quizLatestCloseMs((c.raceStartedAt ?? c.raceStartUtc).toMillis(), c.raceDurationMin);
    const base = minutes > 0 ? Math.max(cur, Date.now()) : cur;
    const wanted = base + minutes * 60_000;
    const next = uncapped ? wanted : Math.min(wanted, cap);
    if (minutes > 0 && next <= cur) throw new Error('The quiz already closes at 30% of the race. It cannot run longer.');
    const patch: Record<string, unknown> = { closesAt: Timestamp.fromMillis(next), updatedAt: serverTimestamp() };
    if (next > cap) patch.override = 'open';
    else if (c.override === 'closed' && minutes > 0) patch.override = 'none';
    tx.update(eventRef(eventId), patch);
  });
  logAudit('event.extend-closes', eventId, `${minutes > 0 ? '+' : ''}${minutes} min${uncapped ? ' (manual, may pass 30%)' : ''}`);
}

/** HOST, at the actual lights out: records the start once (server time), clears the delay and re-anchors the
 * deadline on it (30% of the race from now, less a minute so client clock skew stays inside the rule). */
export async function startQuizRace(eventId: string): Promise<void> {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(eventRef(eventId));
    if (!s.exists()) throw new Error('Event not found');
    const c = s.data() as EventConfig;
    if (c.raceStartedAt) throw new Error('Lights out is already recorded for this quiz.');
    // The window closes 30% of the race after lights out, and the rules need it to close after it opens: pressing
    // this before the quiz has opened would write a close time that is already behind the open time.
    const early = Date.now() < c.opensAt.toMillis();
    if (early && c.override !== 'open') {
      throw new Error('The quiz has not opened yet, so lights out cannot start its clock. Press Open now first, or move the race start to today in the quiz Details.');
    }
    tx.update(eventRef(eventId), {
      raceStartedAt: serverTimestamp(),
      delayed: false,
      closesAt: Timestamp.fromMillis(lightsOutClosesAtMs(Date.now(), c.raceDurationMin)),
      // Opened early by the host: the window starts now, so the new close time is still after it.
      ...(early ? { opensAt: Timestamp.fromMillis(Date.now()) } : {}),
      updatedAt: serverTimestamp(),
    });
  });
  logAudit('event.set-lights-out', eventId, 'actual lights out, 30% clock started');
}

/** HOST: the start is delayed (hold the quiz open past its deadline) or no longer delayed. Ignored after lights out. */
export async function setQuizDelayed(eventId: string, delayed: boolean): Promise<void> {
  await updateDoc(eventRef(eventId), { delayed, updatedAt: serverTimestamp() });
}

/** HOST: the leader's current lap from the broadcast, clamped to a whole number in 0..totalLaps. */
export async function setLiveLap(eventId: string, lap: number): Promise<void> {
  await runTransaction(db, async (tx) => {
    const s = await tx.get(eventRef(eventId));
    if (!s.exists()) throw new Error('Event not found');
    const total = (s.data() as EventConfig).totalLaps;
    if (!total) throw new Error('Set the total laps in the quiz details first.');
    tx.update(eventRef(eventId), { liveLap: clampLap(lap, total), updatedAt: serverTimestamp() });
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

/** The live event's full config (questions, teams, drivers), or null when no event is live. */
export function watchActiveEventConfig(
  cb: (c: EventConfig | null) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return watchUnderActive((id) => watchEventConfig(id, cb, onErr), () => cb(null), onErr);
}

/** A guest's own entry in one quiz. `pending` is true while a local write has not reached the server. */
export function watchOwnEntry(
  eventId: string,
  uid: string,
  cb: (e: Entry | null, pending: boolean) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    entryRef(eventId, uid),
    { includeMetadataChanges: true },
    (s) =>
      cb(
        s.exists() ? ({ ...s.data({ serverTimestamps: 'estimate' }), uid: s.id } as Entry) : null,
        s.metadata.hasPendingWrites,
      ),
    onErr,
  );
}

export interface SubmitEntryInput {
  uid: string;
  name: string;
  email: string;
  photoURL?: string;
  provider: Provider;
  answers: Answers;
  /** The /play link token; firestore.rules requires a valid, unrevoked one on every entry write. */
  accessToken: string;
}

async function requireActive(): Promise<string> {
  const id = await getActiveEventId();
  if (!id) throw new Error('No live event right now.');
  return id;
}

/** Field set written for an entry (pure, so the token is provably on both create and update). */
export function entryWriteData(input: SubmitEntryInput): Record<string, unknown> {
  const { uid, name, email, photoURL, provider, answers, accessToken } = input;
  const data: Record<string, unknown> = { uid, name, email, provider, answers, accessToken };
  if (photoURL !== undefined) data.photoURL = photoURL;
  return data;
}

/** R68: picks are final. Create-only: an existing entry is a clear error, never an overwrite (the rules deny the update too). */
export async function submitEntry(eventId: string, input: SubmitEntryInput): Promise<void> {
  const ref = entryRef(eventId, input.uid);
  const existing = await getDoc(ref).catch(() => null); // offline: fall through, the rules still refuse an overwrite
  if (existing?.exists()) throw Object.assign(new Error('Picks are already locked in.'), { code: 'already-submitted' });
  await setDoc(ref, { ...entryWriteData(input), submittedAt: serverTimestamp(), createdAt: serverTimestamp() });
}

/** The answer key of one quiz (readable once the host reveals the winner). */
export function watchResults(
  eventId: string,
  cb: (r: ResultsDoc | null) => void,
  onErr?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(resultsRef(eventId), (s) => cb(s.exists() ? (s.data() as ResultsDoc) : null), onErr);
}

/** HOST. Results of whichever quiz is live, following the active pointer. */
export function watchActiveResults(
  cb: (r: ResultsDoc | null) => void,
  onErr?: (err: Error) => void,
): Unsubscribe {
  return watchUnderActive((id) => watchResults(id, cb, onErr), () => cb(null), onErr);
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

/** Guest's own quiz history across ALL events (R15/R31/R66: own uid only). One collection-group query
 * on `entries` filtered to the caller's uid (the rules allow exactly that and nothing wider; needs the
 * COLLECTION_GROUP index on `entries.uid`), then a public `get` of each event doc for its config. Entries
 * whose event doc is gone are skipped. Score stays null until the host reveals the winner and publishes
 * results for that event (results are only readable once `winnerRevealed`). */
export async function listOwnEntries(uid: string): Promise<OwnEntryRow[]> {
  const entriesSnap = await getDocs(query(collectionGroup(db, 'entries'), where('uid', '==', uid)));
  const found = await Promise.all(
    entriesSnap.docs.map(async (entrySnap) => {
      const id = entrySnap.ref.parent.parent!.id;
      const es = await getDoc(eventRef(id));
      return es.exists() ? { id, config: es.data() as EventConfig, entrySnap } : null;
    }),
  );
  const items = found.filter((x): x is NonNullable<typeof x> => x !== null);
  const orderOf = new Map(
    [...items]
      .sort(
        (a, b) =>
          (a.config.raceStartUtc?.toMillis() ?? 0) - (b.config.raceStartUtc?.toMillis() ?? 0) ||
          (a.id < b.id ? -1 : 1),
      )
      .map((x, i) => [x.id, i] as const),
  );
  const rows = await Promise.all(
    items.map(async ({ id, config, entrySnap }): Promise<OwnEntryRow | null> => {
      const entry = entrySnap.data() as Entry;
      let score: number | null = null;
      let maxScore: number | undefined;
      if (config.winnerRevealed) {
        const rs = await getDoc(resultsRef(id));
        if (rs.exists()) {
          const key = (rs.data() as ResultsDoc).answers;
          score = scoreEntry(entry.answers, key, config.questionIds, pointsMap(config.questions ?? [])).score;
          const pts = pointsMap(config.questions ?? []);
          maxScore = (config.questionIds ?? Object.keys(key))
            .filter((q) => (key[q] ?? []).length > 0)
            .reduce((n, q) => n + (pts[q] ?? 1), 0);
        }
      }
      return {
        eventId: id,
        eventName: config.name,
        submittedAtMs: entry.submittedAt.toMillis(),
        score,
        maxScore,
        eventOrder: orderOf.get(id),
      };
    }),
  );
  return rows.filter((r): r is OwnEntryRow => r !== null);
}

export async function isHost(email: string): Promise<boolean> {
  const s = await getDoc(doc(db, 'hosts', email.toLowerCase()));
  return s.exists();
}

/** Live results feed for ONE quiz (the per-event results page), independent of which quiz is live. */
export function watchEventResults(
  id: string,
  cb: (r: ResultsDoc | null) => void,
  onErr?: (err: Error) => void,
): Unsubscribe {
  return onSnapshot(resultsRef(id), (s) => cb(s.exists() ? (s.data() as ResultsDoc) : null), onErr);
}

/** Saves the answer key. `eventId` names the quiz (per-event results page); omitted = the live quiz. */
export async function saveResults(r: Results, source: string, eventId?: string): Promise<void> {
  const id = eventId ?? (await requireActive());
  await setDoc(resultsRef(id), { answers: r, source, updatedAt: serverTimestamp() });
  logAudit('results.save', id, source || 'no source note');
}

export async function revealWinner(overrideUid: string | null): Promise<void> {
  const id = await requireActive();
  await updateDoc(eventRef(id), { winnerRevealed: true, tiebreakOverride: overrideUid });
  logAudit('winner.reveal', id, overrideUid ? `tiebreak override uid=${overrideUid}` : 'no override');
}

/* ---------- big-screen podium reveal (PD1), host-only per R15 ---------- */

/** Watches events/{eventId}/screen/state; sealed defaults (lobby, stage 0) if the doc doesn't
 * exist yet, so a fresh event never crashes the big screen before the host has touched it. */
export function watchScreenState(
  eventId: string,
  cb: (s: ScreenState) => void,
  onErr?: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    screenStateRef(eventId),
    (s) => {
      if (!s.exists() && s.metadata.fromCache) return;
      cb(
        s.exists()
          ? (s.data() as ScreenState)
          : { mode: 'lobby', stage: 0, overrideUid: null, updatedAt: Timestamp.now() },
      );
    },
    onErr,
  );
}

/** Partial patch merged onto the existing doc (or seeded with sealed defaults if this is the
 * very first write) — callers (PodiumController) always know the current full state from
 * watchScreenState and pass whichever fields changed. */
export async function setScreenState(
  eventId: string,
  patch: Partial<Pick<ScreenState, 'mode' | 'stage' | 'overrideUid'>>,
): Promise<void> {
  // Merge only the patched keys, so two hosts changing different fields cannot clobber each other.
  await setDoc(
    screenStateRef(eventId),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
