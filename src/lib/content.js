import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where, } from 'firebase/firestore';
import { logAudit } from './audit';
import { db } from './firebase';
export const PARTNER_KINDS = [
    { id: 'sponsor', label: 'Sponsor' },
    { id: 'venue', label: 'Venue partner' },
    { id: 'media', label: 'Media partner' },
    { id: 'community', label: 'Community partner' },
    { id: 'supplier', label: 'Supplier' },
];
export const partnerKindLabel = (k) => PARTNER_KINDS.find((p) => p.id === k)?.label ?? k;
export const STORY_TAGS = [
    { id: 'recap', label: 'Race recap' },
    { id: 'event', label: 'Event' },
    { id: 'community', label: 'Community' },
];
export const storyTagLabel = (t) => STORY_TAGS.find((s) => s.id === t)?.label ?? t;
export const LEGAL_CATEGORIES = [
    { id: 'agreement', label: 'Agreement / contract' },
    { id: 'licence', label: 'Licence' },
    { id: 'permission', label: 'Written permission' },
    { id: 'policy', label: 'Policy / terms' },
    { id: 'registration', label: 'Registration / certificate' },
    { id: 'other', label: 'Other' },
];
export const legalCategoryLabel = (c) => LEGAL_CATEGORIES.find((l) => l.id === c)?.label ?? c;
/** Firestore rejects `undefined`; empty strings are not worth storing. */
function clean(o) {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''));
}
export const isHttps = (s) => /^https:\/\/\S+$/i.test(s.trim()) && s.trim().length <= 500;
const withId = (d) => ({ ...d.data(), id: d.id });
/* ---------- partners ---------- */
const partnersCol = () => collection(db, 'partners');
/** Public: published partners only (the rules grant the list only when it is filtered this way). */
export function watchPublishedPartners(cb, onErr) {
    return onSnapshot(query(partnersCol(), where('published', '==', true)), (s) => cb(s.docs.map((d) => withId(d)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))), onErr);
}
/** Host: every partner, published or not. */
export function watchAllPartners(cb, onErr) {
    return onSnapshot(partnersCol(), (s) => cb(s.docs.map((d) => withId(d)).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.name.localeCompare(b.name))), onErr);
}
export async function getPartnerPrivate(id) {
    const snap = await getDoc(doc(db, 'partnerPrivate', id));
    return snap.exists() ? snap.data() : {};
}
export async function savePartner(id, data, priv) {
    const pid = id ?? doc(partnersCol()).id;
    await setDoc(doc(db, 'partners', pid), { ...clean(data), published: data.published, updatedAt: serverTimestamp() });
    await setDoc(doc(db, 'partnerPrivate', pid), { ...clean(priv), updatedAt: serverTimestamp() });
    logAudit('content.partner', pid, data.name);
    return pid;
}
export async function deletePartner(id) {
    await deleteDoc(doc(db, 'partners', id));
    await deleteDoc(doc(db, 'partnerPrivate', id));
    logAudit('content.partner', id, 'deleted');
}
/* ---------- stories ---------- */
const storiesCol = () => collection(db, 'stories');
const byDateDesc = (a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
export function watchPublishedStories(cb, onErr) {
    return onSnapshot(query(storiesCol(), where('published', '==', true)), (s) => cb(s.docs.map((d) => withId(d)).sort(byDateDesc)), onErr);
}
export function watchAllStories(cb, onErr) {
    return onSnapshot(storiesCol(), (s) => cb(s.docs.map((d) => withId(d)).sort(byDateDesc)), onErr);
}
export async function saveStory(id, data) {
    const sid = id ?? doc(storiesCol()).id;
    await setDoc(doc(db, 'stories', sid), { ...clean(data), published: data.published, updatedAt: serverTimestamp() });
    logAudit('content.story', sid, data.title);
    return sid;
}
export async function deleteStory(id) {
    await deleteDoc(doc(db, 'stories', id));
    logAudit('content.story', id, 'deleted');
}
/* ---------- legal document register (admins only) ---------- */
const legalCol = () => collection(db, 'legalDocs');
export function watchLegalDocs(cb, onErr) {
    return onSnapshot(legalCol(), (s) => cb(s.docs.map((d) => withId(d)).sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title))), onErr);
}
export async function saveLegalDoc(id, data) {
    const lid = id ?? doc(legalCol()).id;
    await setDoc(doc(db, 'legalDocs', lid), { ...clean(data), updatedAt: serverTimestamp() });
    logAudit('content.legal', lid, data.title);
    return lid;
}
export async function deleteLegalDoc(id) {
    await deleteDoc(doc(db, 'legalDocs', id));
    logAudit('content.legal', id, 'deleted');
}
