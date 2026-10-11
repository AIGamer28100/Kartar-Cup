import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { randomToken } from './token';

/* The quiz is for people at the live event, not the public. It has no page on the site: the host shares a
 * link (or its QR code) of the form /play/<token>. The token is a capability: `playLinks/{token}` names the
 * quiz it opens, can be read only by its exact path (never listed by guests) and is revoked by the host.
 * firestore.rules also requires a valid, unrevoked token on every entry write, so knowing the quiz's id is
 * not enough to submit picks. */

export interface PlayLink {
  /** The token itself (also the document id). */
  token: string;
  /** The `events/{id}` quiz this link opens. */
  eventId: string;
  revoked: boolean;
}

export const PLAY_LINK_LENGTH = 24;
export const PLAY_PATH = '/play';
export const playPath = (token: string): string => `${PLAY_PATH}/${token}`;
/** The full shareable URL (what the QR code encodes). */
export const playUrl = (token: string, origin = window.location.origin): string => `${origin}${playPath(token)}`;

/** Does this look like a play token (so a junk path never reaches Firestore)? */
export const isPlayToken = (s: string): boolean => /^[A-Za-z0-9]{24}$/.test(s);

const linkRef = (token: string) => doc(db, 'playLinks', token);

/** Resolve a token to the quiz it opens, or null when it is unknown or revoked. One exact-path read. */
export async function resolvePlayLink(token: string): Promise<PlayLink | null> {
  if (!isPlayToken(token)) return null;
  const s = await getDoc(linkRef(token));
  if (!s.exists()) return null;
  const d = s.data() as { eventId?: unknown; revoked?: unknown };
  if (typeof d.eventId !== 'string' || d.revoked === true) return null;
  return { token, eventId: d.eventId, revoked: false };
}

/** HOST. Create a fresh link for a quiz. Older links keep working until the host revokes them. */
export async function createPlayLink(eventId: string): Promise<PlayLink> {
  const email = auth.currentUser?.email;
  if (!email) throw new Error('not signed in');
  const token = randomToken(PLAY_LINK_LENGTH);
  await setDoc(linkRef(token), { eventId, revoked: false, createdAt: serverTimestamp(), createdBy: email.toLowerCase() });
  return { token, eventId, revoked: false };
}

/** HOST. Switch a link off: it stops opening the quiz and entries made with it are refused. */
export async function revokePlayLink(token: string): Promise<void> {
  await updateDoc(linkRef(token), { revoked: true, revokedAt: serverTimestamp() });
}

/** HOST. The live (unrevoked) links of one quiz, newest first. */
export function watchPlayLinks(eventId: string, cb: (links: PlayLink[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'playLinks'), where('eventId', '==', eventId), where('revoked', '==', false)),
    (snap) => {
      const rows = snap.docs.map((d) => ({ token: d.id, eventId, revoked: false, at: (d.data().createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0 }));
      rows.sort((a, b) => b.at - a.at);
      cb(rows.map(({ token, eventId: e, revoked }) => ({ token, eventId: e, revoked })));
    },
    onErr,
  );
}
