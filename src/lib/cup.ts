import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  type Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { logAudit } from './audit';
import { db } from './firebase';
import {
  computeStandings,
  type CupDriver,
  type CupResult,
  type CupRound,
  type CupSeason,
  type RoundWithResult,
  type Standings,
} from './cupScoring';

export * from './cupScoring';

/** Karter Cup data (PRD s24). Hosts write; the public reads PUBLISHED seasons/rounds/standings only
 * (firestore.rules `cupSeasons`). With no Cloud Functions, standings are precomputed HERE, in the host's
 * browser, whenever scoring inputs change, into cupSeasons/{id}/standings/current so the public page
 * reads one cheap document instead of recomputing the season (PRD s24.6). */

const seasonRef = (id: string) => doc(db, 'cupSeasons', id);
const driversCol = (sid: string) => collection(db, 'cupSeasons', sid, 'drivers');
const roundsCol = (sid: string) => collection(db, 'cupSeasons', sid, 'rounds');
const resultRef = (sid: string, rid: string) => doc(db, 'cupSeasons', sid, 'rounds', rid, 'results', 'final');
const standingsRef = (sid: string) => doc(db, 'cupSeasons', sid, 'standings', 'current');

type Err = (e: Error) => void;
const withId = <T>(s: { id: string; data: () => unknown }) => ({ ...(s.data() as object), id: s.id }) as T;

/* ---------- reads ---------- */

/** Public. The `where` is required by the rules, not cosmetic: unpublished seasons are host-only. */
export function watchPublishedSeasons(cb: (s: CupSeason[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'cupSeasons'), where('published', '==', true)),
    (s) => cb(s.docs.map((d) => withId<CupSeason>(d))),
    onErr,
  );
}

/** Host: every season. */
export function watchAllSeasons(cb: (s: CupSeason[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(collection(db, 'cupSeasons'), (s) => cb(s.docs.map((d) => withId<CupSeason>(d))), onErr);
}

export function watchDrivers(sid: string, cb: (d: CupDriver[]) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(driversCol(sid), (s) => cb(s.docs.map((d) => withId<CupDriver>(d))), onErr);
}

/** publishedOnly is required for the public page (rules); hosts pass false to see drafts. */
export function watchRounds(sid: string, publishedOnly: boolean, cb: (r: CupRound[]) => void, onErr?: Err): Unsubscribe {
  const c = roundsCol(sid);
  return onSnapshot(
    publishedOnly ? query(c, where('published', '==', true)) : c,
    (s) => cb(s.docs.map((d) => withId<CupRound>(d))),
    onErr,
  );
}

export function watchStandings(sid: string, cb: (s: (Standings & { updatedAt?: Timestamp }) | null) => void, onErr?: Err): Unsubscribe {
  return onSnapshot(standingsRef(sid), (s) => cb(s.exists() ? (s.data() as Standings) : null), onErr);
}

export async function getResult(sid: string, rid: string): Promise<CupResult | null> {
  const s = await getDoc(resultRef(sid, rid));
  return s.exists() ? (s.data() as CupResult) : null;
}

/* ---------- standings (host) ---------- */

/** Reads the whole season (host can read drafts) and rewrites standings/current. Only published,
 * completed rounds with a result count. Throws on any failure: the caller shows it. */
export async function recomputeStandings(sid: string, quiet = false): Promise<Standings> {
  const [seasonSnap, dSnap, rSnap] = await Promise.all([getDoc(seasonRef(sid)), getDocs(driversCol(sid)), getDocs(roundsCol(sid))]);
  if (!seasonSnap.exists()) throw new Error('Season not found.');
  const season = seasonSnap.data() as CupSeason;
  const drivers = dSnap.docs.map((d) => withId<CupDriver>(d));
  const rounds = rSnap.docs.map((d) => withId<CupRound>(d));
  const withResults: RoundWithResult[] = await Promise.all(
    rounds.map(async (r) =>
      r.published && r.status === 'completed' ? { ...r, result: await getResult(sid, r.id) } : { ...r, result: null },
    ),
  );
  const standings = computeStandings(drivers, withResults, season.pointsTable ?? [], season.fastestLapBonus ?? 0);
  await setDoc(standingsRef(sid), { ...standings, updatedAt: serverTimestamp() });
  if (!quiet) logAudit('cup.standings', sid, `${standings.roundsCounted} rounds`);
  return standings;
}

/** Runs a write, then refreshes standings. A failed refresh is surfaced, never swallowed. */
async function thenRecompute(sid: string): Promise<void> {
  try {
    await recomputeStandings(sid, true);
  } catch (e) {
    throw new Error(`Saved, but standings could not be updated: ${e instanceof Error ? e.message : 'unknown error'}. Use Recompute standings to retry.`);
  }
}

/* ---------- writes (host) ---------- */

export type NewSeason = Omit<CupSeason, 'id'>;

export async function createSeason(data: NewSeason): Promise<string> {
  const ref = doc(collection(db, 'cupSeasons'));
  await setDoc(ref, { ...data, updatedAt: serverTimestamp() });
  logAudit('cup.season', ref.id, `create ${data.name}`.slice(0, 120));
  return ref.id;
}

/** Writes the full season doc (rules validate the whole shape on every write). */
export async function saveSeason(season: CupSeason): Promise<void> {
  const { id, ...data } = season;
  await setDoc(seasonRef(id), { ...data, updatedAt: serverTimestamp() });
  logAudit('cup.season', id, `${season.published ? 'published' : 'draft'} ${season.name}`.slice(0, 120));
  await thenRecompute(id);
}

export async function saveDriver(sid: string, d: CupDriver): Promise<string> {
  const ref = d.id ? doc(driversCol(sid), d.id) : doc(driversCol(sid));
  const { id: _id, ...rest } = d;
  void _id;
  const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  await setDoc(ref, data);
  logAudit('cup.driver', sid, `${d.id ? 'edit' : 'add'} ${d.name}`.slice(0, 120));
  await thenRecompute(sid);
  return ref.id;
}

export async function deleteDriver(sid: string, d: CupDriver): Promise<void> {
  await deleteDoc(doc(driversCol(sid), d.id));
  logAudit('cup.driver', sid, `remove ${d.name}`.slice(0, 120));
  await thenRecompute(sid);
}

export async function saveRound(sid: string, r: CupRound): Promise<string> {
  const ref = r.id ? doc(roundsCol(sid), r.id) : doc(roundsCol(sid));
  const { id: _id, ...rest } = r;
  void _id;
  const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  await setDoc(ref, data);
  logAudit('cup.round', sid, `${r.id ? 'edit' : 'add'} ${r.name}`.slice(0, 120));
  await thenRecompute(sid);
  return ref.id;
}

export async function deleteRound(sid: string, r: CupRound): Promise<void> {
  await deleteDoc(resultRef(sid, r.id));
  await deleteDoc(doc(roundsCol(sid), r.id));
  logAudit('cup.round', sid, `remove ${r.name}`.slice(0, 120));
  await thenRecompute(sid);
}

export async function saveResult(sid: string, round: CupRound, result: CupResult): Promise<void> {
  const data: Record<string, unknown> = { order: result.order, dnf: result.dnf ?? [], updatedAt: serverTimestamp() };
  if (result.fastestLap) data.fastestLap = result.fastestLap;
  await setDoc(resultRef(sid, round.id), data);
  logAudit('cup.results', sid, round.name.slice(0, 120));
  await thenRecompute(sid);
}
