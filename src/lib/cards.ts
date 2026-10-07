import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { logAudit } from './audit';
import { db } from './firebase';
import type { Booking, BookingEvent, CardDoc, PlayCardSnapshot } from './types';

/* R45/R46: per-event VIP pass + Play card designs. Images are either a CDN link (Cloudflare R2,
 * preferred) or a small compressed inline image, because Firebase Storage is not set up on this plan. */

const cardsCol = (eventId: string) => collection(db, 'bookingEvents', eventId, 'cards');
const cardRef = (eventId: string, cardId: string) => doc(db, 'bookingEvents', eventId, 'cards', cardId);

const byOrder = (a: CardDoc, b: CardDoc) => a.order - b.order || a.id.localeCompare(b.id);

/** Guest: fetch a single Play card design by id (loaded from the snapshot's cardId). */
export async function getCard(eventId: string, cardId: string): Promise<CardDoc | null> {
  try {
    const snap = await getDoc(cardRef(eventId, cardId));
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as CardDoc) : null;
  } catch {
    return null;
  }
}

/** Host: every design for the event (VIP + all Play cards). */
export function watchCards(eventId: string, cb: (c: CardDoc[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    cardsCol(eventId),
    (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }) as CardDoc).sort(byOrder)),
    onErr,
  );
}

/** Guest: the VIP design only. The rules grant the list only when it is filtered to kind == 'vip', so
 * the Play-card deck is never readable by guests (R15). */
export function watchVipCards(eventId: string, cb: (c: CardDoc[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(cardsCol(eventId), where('kind', '==', 'vip')),
    (s) => cb(s.docs.map((d) => ({ ...d.data(), id: d.id }) as CardDoc).sort(byOrder)),
    onErr,
  );
}

export type CardInput = Omit<CardDoc, 'id' | 'updatedAt'> & { id?: string };

/** Firestore rejects `undefined`, and empty strings should not be stored: keep only real values. */
function clean<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>;
}

/** Host: create or replace one design. Returns its id. */
export async function saveCard(eventId: string, input: CardInput): Promise<string> {
  const id = input.id ?? doc(cardsCol(eventId)).id;
  const { id: _omit, ...rest } = input;
  await setDoc(cardRef(eventId, id), { ...clean(rest), updatedAt: serverTimestamp() });
  logAudit('card.save', eventId, `${input.kind}${input.code ? ` ${input.code}` : ''}`);
  return id;
}

export async function deleteCard(eventId: string, cardId: string): Promise<void> {
  await deleteDoc(cardRef(eventId, cardId));
  logAudit('card.delete', eventId, cardId);
}

/** The src for a card image: a CDN link wins over an inline image. */
export function cardImageSrc(c: { image?: string; imageUrl?: string } | null | undefined): string | undefined {
  return c?.imageUrl || c?.image || undefined;
}

export function toSnapshot(c: CardDoc): PlayCardSnapshot {
  return clean({
    cardId: c.id,
    driverName: c.driverName ?? c.title ?? 'Driver',
    code: c.code,
    number: c.number,
    points: c.points ?? 0,
  }) as PlayCardSnapshot;
}

/** Physical cards are drawn at random (R45); this is the digital equivalent for the host's draw button. */
export function drawRandomPlayCard(cards: CardDoc[], rand: () => number = Math.random): CardDoc | null {
  const deck = cards.filter((c) => c.kind === 'play');
  return deck.length ? deck[Math.min(deck.length - 1, Math.floor(rand() * deck.length))] : null;
}

/** Highest-numbered pass is `cardSeq`; the next guest gets cardSeq + 1. */
export const nextPassNumber = (ev: Pick<BookingEvent, 'cardSeq'>): number => (ev.cardSeq ?? 0) + 1;

/** Host, at check-in: give the guest their VIP pass number (kept if they already have one) and, if
 * given, their Play card (a snapshot copy so the guest can read it without reading the host-only deck).
 * One transaction so two hosts at two doors never hand out the same pass number. */
export async function assignCards(
  bookingId: string,
  playCard: CardDoc | null,
): Promise<{ passNumber: number; playCard: PlayCardSnapshot | null }> {
  const bRef = doc(db, 'bookings', bookingId);
  const result = await runTransaction(db, async (tx) => {
    const bSnap = await tx.get(bRef);
    if (!bSnap.exists()) throw new Error('Booking not found.');
    const b = bSnap.data() as Booking;
    if (b.status !== 'paid_mock' && b.status !== 'checked_in') throw new Error('Only paid bookings can receive cards.');
    const eRef = doc(db, 'bookingEvents', b.bookingEventId);
    const eSnap = await tx.get(eRef);
    if (!eSnap.exists()) throw new Error('Event not found.');
    const ev = eSnap.data() as BookingEvent;

    let passNumber = b.passNumber;
    if (!passNumber) {
      passNumber = nextPassNumber(ev);
      tx.update(eRef, { cardSeq: passNumber, updatedAt: serverTimestamp() });
    }
    const snap = playCard ? toSnapshot(playCard) : (b.playCard ?? null);
    tx.update(bRef, clean({ passNumber, playCard: snap ?? undefined }));
    return { passNumber, playCard: snap };
  });
  logAudit('card.assign', bookingId, `pass ${result.passNumber}${result.playCard ? `, ${result.playCard.code ?? result.playCard.driverName}` : ''}`);
  return result;
}

/** Downscale a picked image file to a compact WebP data URL under the rules' size limit (~450k chars). */
export async function fileToCardImage(
  file: File,
  maxSide = 900,
  maxChars = 400_000,
): Promise<{ image: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('Pick an image file.');
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const width = Math.max(1, Math.round(bmp.width * scale));
  const height = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image in this browser.');
  ctx.drawImage(bmp, 0, 0, width, height);
  bmp.close?.();
  for (const q of [0.85, 0.75, 0.65, 0.55, 0.45, 0.35]) {
    const url = canvas.toDataURL('image/webp', q);
    if (url.length <= maxChars) return { image: url, width, height };
  }
  throw new Error('That image is too detailed to store inline. Use a smaller image or paste a CDN link instead.');
}
