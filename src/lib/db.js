import { Timestamp, collection, doc, getDoc, getDocs, onSnapshot, runTransaction, serverTimestamp, setDoc, updateDoc, } from 'firebase/firestore';
import { logAudit } from './audit';
import { db } from './firebase';
import { deriveStatus } from './eventStatus';
import { pointsMap, scoreEntry } from './scoring';
import { ALL_RACES, nextRace } from '../config/calendar';
import { buildDefaultEvent } from '../config/event';
const activeRef = () => doc(db, 'settings', 'active');
const eventRef = (id) => doc(db, 'events', id);
const resultsRef = (id) => doc(db, 'events', id, 'results', 'answers');
const entryRef = (id, uid) => doc(db, 'events', id, 'entries', uid);
const screenStateRef = (id) => doc(db, 'events', id, 'screen', 'state');
/* ---------- multi-event API ---------- */
export function watchActiveEventId(cb, onErr) {
    return onSnapshot(activeRef(), (s) => {
        if (!s.exists() && s.metadata.fromCache)
            return; // offline + empty cache = unknown, not "no event"
        cb(s.exists() ? (s.data().eventId ?? null) : null);
    }, onErr);
}
export function watchEventConfig(id, cb, onErr) {
    return onSnapshot(eventRef(id), (s) => {
        if (!s.exists() && s.metadata.fromCache)
            return; // offline + empty cache = unknown
        cb(s.exists() ? s.data() : null);
    }, onErr);
}
export async function getActiveEventId() {
    const s = await getDoc(activeRef());
    return s.exists() ? (s.data().eventId ?? null) : null;
}
export async function saveEventConfig(config) {
    await setDoc(eventRef(config.id), { ...config, updatedAt: serverTimestamp() });
    logAudit('event.save', config.id, config.name);
}
export async function setActiveEvent(eventId) {
    await setDoc(activeRef(), { eventId });
    logAudit('event.go-live', eventId);
}
export async function setOverride(eventId, override) {
    await updateDoc(eventRef(eventId), { override, updatedAt: serverTimestamp() });
    logAudit('event.override', eventId, `override=${override}`);
}
export async function extendCloses(eventId, minutes) {
    // Transaction, not read-then-write: two hosts extending at once must both count, not clobber.
    await runTransaction(db, async (tx) => {
        const s = await tx.get(eventRef(eventId));
        if (!s.exists())
            throw new Error('Event not found');
        const cur = s.data().closesAt.toMillis();
        tx.update(eventRef(eventId), {
            closesAt: Timestamp.fromMillis(cur + minutes * 60_000),
            updatedAt: serverTimestamp(),
        });
    });
    logAudit('event.extend-closes', eventId, `${minutes > 0 ? '+' : ''}${minutes} min`);
}
/** Subscribe to something under the active event, re-subscribing when the active event changes. */
function watchUnderActive(inner, onNone, onErr) {
    let innerUnsub = null;
    let current;
    const outer = watchActiveEventId((id) => {
        if (id === current)
            return;
        current = id;
        innerUnsub?.();
        innerUnsub = null;
        if (id)
            innerUnsub = inner(id);
        else
            onNone();
    }, onErr);
    return () => {
        outer();
        innerUnsub?.();
    };
}
/* ---------- legacy wrappers over the active event ---------- */
function toLegacy(c, nowMs) {
    const s = deriveStatus(c, nowMs);
    return {
        status: s === 'scored' ? 'scored' : s === 'open' ? 'open' : 'locked',
        lightsOutUtc: c.closesAt, // legacy consumers treat this as the moment picks lock
        winnerRevealed: c.winnerRevealed,
        tiebreakOverride: c.tiebreakOverride,
    };
}
/** The live event's full config (questions, teams, drivers), or null when no event is live. */
export function watchActiveEventConfig(cb, onErr) {
    return watchUnderActive((id) => watchEventConfig(id, cb, onErr), () => cb(null), onErr);
}
export function watchEvent(cb, onErr) {
    let cfg = null;
    let last = null;
    const emit = () => {
        const e = cfg ? toLegacy(cfg, Date.now()) : null;
        const key = e ? `${e.status}|${e.lightsOutUtc.toMillis()}|${e.winnerRevealed}|${e.tiebreakOverride}` : 'null';
        if (key === last)
            return;
        last = key;
        cb(e);
    };
    const timer = setInterval(emit, 1000);
    const unsub = watchUnderActive((id) => watchEventConfig(id, (c) => {
        cfg = c;
        emit();
    }, onErr), () => {
        cfg = null;
        emit();
    }, onErr);
    return () => {
        clearInterval(timer);
        unsub();
    };
}
export function watchOwnEntry(uid, cb) {
    return watchUnderActive((id) => onSnapshot(entryRef(id, uid), { includeMetadataChanges: true }, (s) => cb(s.exists() ? { ...s.data({ serverTimestamps: 'estimate' }), uid: s.id } : null, s.metadata.hasPendingWrites)), () => cb(null, false));
}
async function requireActive() {
    const id = await getActiveEventId();
    if (!id)
        throw new Error('No live event right now.');
    return id;
}
export async function submitEntry(input, isFirst) {
    const id = await requireActive();
    const { uid, name, email, phone, photoURL, provider, answers } = input;
    const data = { uid, name, email, provider, answers };
    if (phone !== undefined)
        data.phone = phone;
    if (photoURL !== undefined)
        data.photoURL = photoURL;
    if (isFirst) {
        await setDoc(entryRef(id, uid), {
            ...data,
            submittedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
        });
    }
    else {
        await setDoc(entryRef(id, uid), { ...data, submittedAt: serverTimestamp() }, { merge: true });
    }
}
export function watchResults(cb, onErr) {
    return watchUnderActive((id) => onSnapshot(resultsRef(id), (s) => cb(s.exists() ? s.data() : null), onErr), () => cb(null), onErr);
}
export function watchEntries(cb, onErr) {
    return watchUnderActive((id) => onSnapshot(collection(db, 'events', id, 'entries'), (s) => cb(s.docs.map((d) => ({ ...d.data({ serverTimestamps: 'estimate' }), uid: d.id }))), onErr), () => cb([]), onErr);
}
/** Guest's own quiz history across ALL events (R15/R31: own uid only). `events/*` is publicly
 * readable (list) so we can enumerate event ids, then `get` each `entries/{uid}` doc directly —
 * a per-uid `get`, never a cross-user `list`, exactly what the entries rule allows a non-host to
 * do. Score stays null until the host reveals the winner and publishes results for that event
 * (results are only readable once `winnerRevealed`). */
export async function listOwnEntries(uid) {
    const eventsSnap = await getDocs(collection(db, 'events'));
    const orderOf = new Map([...eventsSnap.docs]
        .sort((a, b) => (a.data().raceStartUtc?.toMillis() ?? 0) -
        (b.data().raceStartUtc?.toMillis() ?? 0) || (a.id < b.id ? -1 : 1))
        .map((d, i) => [d.id, i]));
    const rows = await Promise.all(eventsSnap.docs.map(async (ed) => {
        const config = ed.data();
        const entrySnap = await getDoc(entryRef(ed.id, uid));
        if (!entrySnap.exists())
            return null;
        const entry = entrySnap.data();
        let score = null;
        let maxScore;
        if (config.winnerRevealed) {
            const rs = await getDoc(resultsRef(ed.id));
            if (rs.exists()) {
                const key = rs.data().answers;
                score = scoreEntry(entry.answers, key, config.questionIds, pointsMap(config.questions ?? [])).score;
                const pts = pointsMap(config.questions ?? []);
                maxScore = (config.questionIds ?? Object.keys(key))
                    .filter((q) => (key[q] ?? []).length > 0)
                    .reduce((n, q) => n + (pts[q] ?? 1), 0);
            }
        }
        return {
            eventId: ed.id,
            eventName: config.name,
            submittedAtMs: entry.submittedAt.toMillis(),
            score,
            maxScore,
            eventOrder: orderOf.get(ed.id),
        };
    }));
    return rows.filter((r) => r !== null);
}
export async function isHost(email) {
    const s = await getDoc(doc(db, 'hosts', email.toLowerCase()));
    return s.exists();
}
/** Legacy: create the first event (next calendar race), open now, picks lock at the given time; make it active. */
export async function initEvent(lightsOutIso) {
    if (await getActiveEventId())
        return;
    const race = nextRace(new Date(), ALL_RACES) ?? ALL_RACES[0];
    const { config: base } = await buildDefaultEvent(race);
    const nowMs = Date.now();
    const config = {
        ...base,
        raceStartUtc: Timestamp.fromMillis(nowMs),
        opensAt: Timestamp.fromMillis(nowMs),
        closesAt: Timestamp.fromMillis(new Date(lightsOutIso).getTime()),
    };
    await saveEventConfig(config);
    await setActiveEvent(config.id);
}
export async function setEventStatus(s) {
    const id = await requireActive();
    if (s === 'scored') {
        await updateDoc(eventRef(id), { winnerRevealed: true });
        logAudit('winner.reveal', id, 'via status=scored');
    }
    else
        await setOverride(id, s === 'open' ? 'open' : 'closed');
}
/** Legacy: moves the moment picks lock (closesAt). */
export async function setLightsOut(iso) {
    const id = await requireActive();
    await updateDoc(eventRef(id), {
        closesAt: Timestamp.fromMillis(new Date(iso).getTime()),
        updatedAt: serverTimestamp(),
    });
    logAudit('event.set-lights-out', id, iso);
}
export async function saveResults(r, source) {
    const id = await requireActive();
    await setDoc(resultsRef(id), { answers: r, source, updatedAt: serverTimestamp() });
    logAudit('results.save', id, source || 'no source note');
}
export async function revealWinner(overrideUid) {
    const id = await requireActive();
    await updateDoc(eventRef(id), { winnerRevealed: true, tiebreakOverride: overrideUid });
    logAudit('winner.reveal', id, overrideUid ? `tiebreak override uid=${overrideUid}` : 'no override');
}
/* ---------- big-screen podium reveal (PD1), host-only per R15 ---------- */
/** Watches events/{eventId}/screen/state; sealed defaults (lobby, stage 0) if the doc doesn't
 * exist yet, so a fresh event never crashes the big screen before the host has touched it. */
export function watchScreenState(eventId, cb, onErr) {
    return onSnapshot(screenStateRef(eventId), (s) => {
        if (!s.exists() && s.metadata.fromCache)
            return;
        cb(s.exists()
            ? s.data()
            : { mode: 'lobby', stage: 0, overrideUid: null, updatedAt: Timestamp.now() });
    }, onErr);
}
/** Partial patch merged onto the existing doc (or seeded with sealed defaults if this is the
 * very first write) — callers (PodiumController) always know the current full state from
 * watchScreenState and pass whichever fields changed. */
export async function setScreenState(eventId, patch) {
    const s = await getDoc(screenStateRef(eventId));
    const base = s.exists()
        ? s.data()
        : { mode: 'lobby', stage: 0, overrideUid: null };
    await setDoc(screenStateRef(eventId), { ...base, ...patch, updatedAt: serverTimestamp() }, { merge: true });
}
