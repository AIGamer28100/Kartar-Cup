import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
  type Unsubscribe,
  writeBatch,
} from 'firebase/firestore';
import { logAudit } from './audit';
import { db } from './firebase';

/* Partners, stories and the legal-document register. Everything here is typed in by the host: nothing is
 * invented or seeded (R26/R27). Public pages read PUBLISHED docs only; contact details and legal links
 * live in separate host/admin-only collections (see firestore.rules). */

export type PartnerKind = 'sponsor' | 'venue' | 'media' | 'community' | 'supplier';
export const PARTNER_KINDS: { id: PartnerKind; label: string }[] = [
  { id: 'sponsor', label: 'Sponsor' },
  { id: 'venue', label: 'Venue partner' },
  { id: 'media', label: 'Media partner' },
  { id: 'community', label: 'Community partner' },
  { id: 'supplier', label: 'Supplier' },
];
export const partnerKindLabel = (k: string) => PARTNER_KINDS.find((p) => p.id === k)?.label ?? k;

export interface Partner {
  id: string;
  name: string;
  kind: PartnerKind;
  blurb?: string;
  website?: string;
  logoUrl?: string;
  order?: number;
  published: boolean;
  updatedAt?: Timestamp;
}
/** Host-only details for the same partner id. Never shown publicly. */
export interface PartnerPrivate {
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  /** Partner since (YYYY-MM-DD). */
  since?: string;
  /** Deal notes: what was agreed, deliverables, renewal. */
  terms?: string;
}

export type StoryTag = 'recap' | 'event' | 'community';
export const STORY_TAGS: { id: StoryTag; label: string }[] = [
  { id: 'recap', label: 'Race recap' },
  { id: 'event', label: 'Event' },
  { id: 'community', label: 'Community' },
];
export const storyTagLabel = (t: string) => STORY_TAGS.find((s) => s.id === t)?.label ?? t;

export interface Story {
  id: string;
  title: string;
  summary?: string;
  body?: string;
  coverUrl?: string;
  /** YYYY-MM-DD. */
  date: string;
  tag: StoryTag;
  published: boolean;
  updatedAt?: Timestamp;
}

export type LegalCategory = 'agreement' | 'licence' | 'permission' | 'policy' | 'registration' | 'other';
export const LEGAL_CATEGORIES: { id: LegalCategory; label: string }[] = [
  { id: 'agreement', label: 'Agreement / contract' },
  { id: 'licence', label: 'Licence' },
  { id: 'permission', label: 'Written permission' },
  { id: 'policy', label: 'Policy / terms' },
  { id: 'registration', label: 'Registration / certificate' },
  { id: 'other', label: 'Other' },
];
export const legalCategoryLabel = (c: string) => LEGAL_CATEGORIES.find((l) => l.id === c)?.label ?? c;

/** A pointer to where the original document is stored (Drive, Notion, a lawyer's portal...). The file
 * itself is never copied into the app: only the link, a note on where it lives, and who it concerns. */
export interface LegalDoc {
  id: string;
  title: string;
  category: LegalCategory;
  url: string;
  where?: string;
  partnerId?: string;
  signedOn?: string;
  expiresOn?: string;
  notes?: string;
  updatedAt?: Timestamp;
}

/** Firestore rejects `undefined`; empty strings are not worth storing. */
function clean<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) as Partial<T>;
}

export const isHttps = (s: string): boolean => /^https:\/\/\S+$/i.test(s.trim()) && s.trim().length <= 500;

const withId = <T,>(d: { id: string; data: () => object }) => ({ ...d.data(), id: d.id }) as unknown as T;

/* ---------- partners ---------- */

const partnersCol = () => collection(db, 'partners');

/** Public: published partners only (the rules grant the list only when it is filtered this way). */
export function watchPublishedPartners(cb: (p: Partner[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(partnersCol(), where('published', '==', true)),
    (s) => cb(s.docs.map((d) => withId<Partner>(d)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))),
    onErr,
  );
}

/** Host: every partner, published or not. */
export function watchAllPartners(cb: (p: Partner[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    partnersCol(),
    (s) => cb(s.docs.map((d) => withId<Partner>(d)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))),
    onErr,
  );
}

export async function getPartnerPrivate(id: string): Promise<PartnerPrivate> {
  const snap = await getDoc(doc(db, 'partnerPrivate', id));
  return snap.exists() ? (snap.data() as PartnerPrivate) : {};
}

export async function savePartner(
  id: string | undefined,
  data: Omit<Partner, 'id' | 'updatedAt'>,
  priv: PartnerPrivate,
): Promise<string> {
  const pid = id ?? doc(partnersCol()).id;
  // One batch: the public card and its private contact notes are saved together or not at all.
  const batch = writeBatch(db);
  batch.set(doc(db, 'partners', pid), { ...clean(data), published: data.published, updatedAt: serverTimestamp() });
  batch.set(doc(db, 'partnerPrivate', pid), { ...clean(priv), updatedAt: serverTimestamp() });
  await batch.commit();
  logAudit('content.partner', pid, data.name);
  return pid;
}

export async function deletePartner(id: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'partners', id));
  batch.delete(doc(db, 'partnerPrivate', id));
  await batch.commit();
  logAudit('content.partner', id, 'deleted');
}

/* ---------- stories ---------- */

const storiesCol = () => collection(db, 'stories');
const byDateDesc = (a: Story, b: Story) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title);

export function watchPublishedStories(cb: (s: Story[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(storiesCol(), where('published', '==', true)),
    (s) => cb(s.docs.map((d) => withId<Story>(d)).sort(byDateDesc)),
    onErr,
  );
}

export function watchAllStories(cb: (s: Story[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(storiesCol(), (s) => cb(s.docs.map((d) => withId<Story>(d)).sort(byDateDesc)), onErr);
}

export async function saveStory(id: string | undefined, data: Omit<Story, 'id' | 'updatedAt'>): Promise<string> {
  const sid = id ?? doc(storiesCol()).id;
  await setDoc(doc(db, 'stories', sid), { ...clean(data), published: data.published, updatedAt: serverTimestamp() });
  logAudit('content.story', sid, data.title);
  return sid;
}

export async function deleteStory(id: string): Promise<void> {
  await deleteDoc(doc(db, 'stories', id));
  logAudit('content.story', id, 'deleted');
}

/* ---------- legal document register (admins only) ---------- */

const legalCol = () => collection(db, 'legalDocs');

export function watchLegalDocs(cb: (d: LegalDoc[]) => void, onErr?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    legalCol(),
    (s) => cb(s.docs.map((d) => withId<LegalDoc>(d)).sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))),
    onErr,
  );
}

export async function saveLegalDoc(id: string | undefined, data: Omit<LegalDoc, 'id' | 'updatedAt'>): Promise<string> {
  const lid = id ?? doc(legalCol()).id;
  await setDoc(doc(db, 'legalDocs', lid), { ...clean(data), updatedAt: serverTimestamp() });
  logAudit('content.legal', lid, data.title);
  return lid;
}

export async function deleteLegalDoc(id: string): Promise<void> {
  await deleteDoc(doc(db, 'legalDocs', id));
  logAudit('content.legal', id, 'deleted');
}
