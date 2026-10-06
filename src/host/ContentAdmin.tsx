import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowSquareOut, Trash } from '@phosphor-icons/react';
import Button from '../components/Button';
import { RowsSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import {
  LEGAL_CATEGORIES,
  PARTNER_KINDS,
  STORY_TAGS,
  deleteLegalDoc,
  deletePartner,
  deleteStory,
  getPartnerPrivate,
  isHttps,
  legalCategoryLabel,
  partnerKindLabel,
  saveLegalDoc,
  savePartner,
  saveStory,
  storyTagLabel,
  watchAllPartners,
  watchAllStories,
  watchLegalDocs,
  type LegalCategory,
  type LegalDoc,
  type Partner,
  type PartnerKind,
  type PartnerPrivate,
  type Story,
  type StoryTag,
} from '../lib/content';
import { inputCls } from './settings/ui';

/* Host > Content: partners, stories and the legal-document register in one place. The register holds LINKS to
 * the originals (wherever they live: Drive, Notion, a lawyer's portal) so nobody has to hunt through personal
 * storage when an issue comes up; the files themselves are never copied here. Admins only for the register. */

const lbl = 'block text-sm text-muted';
const mono = 'font-mono tabular-nums';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={lbl}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function FormShell({ title, onSubmit, onCancel, busy, err, children }: { title: string; onSubmit: () => void; onCancel: () => void; busy: boolean; err: string; children: ReactNode }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mt-4 grid gap-3 rounded-lg border border-line p-4"
    >
      <p className="font-medium">{title}</p>
      {children}
      {err && <p role="alert" className="text-sm text-accent-text">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}

function useList<T>(watch: (cb: (v: T[]) => void, onErr?: (e: Error) => void) => () => void) {
  const [items, setItems] = useState<T[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => watch(setItems, (e) => setErr(e.message)), [watch]);
  return { items, err };
}

const StatePill = ({ on, yes, no }: { on: boolean; yes: string; no: string }) => (
  <span className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-medium ${on ? 'bg-accent/15 text-accent-text' : 'bg-raised text-muted'}`}>{on ? yes : no}</span>
);

/* ---------------- partners ---------------- */

function PartnerForm({ partner, onDone }: { partner?: Partner; onDone: () => void }) {
  const [name, setName] = useState(partner?.name ?? '');
  const [kind, setKind] = useState<PartnerKind>(partner?.kind ?? 'sponsor');
  const [blurb, setBlurb] = useState(partner?.blurb ?? '');
  const [website, setWebsite] = useState(partner?.website ?? '');
  const [logoUrl, setLogoUrl] = useState(partner?.logoUrl ?? '');
  const [order, setOrder] = useState(partner?.order != null ? String(partner.order) : '');
  const [published, setPublished] = useState(partner?.published ?? false);
  const [priv, setPriv] = useState<PartnerPrivate>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (partner) void getPartnerPrivate(partner.id).then(setPriv).catch(() => undefined);
  }, [partner]);

  async function submit() {
    setErr('');
    if (!name.trim()) return setErr('Enter the partner name.');
    if (website.trim() && !isHttps(website)) return setErr('The website must start with https://');
    if (logoUrl.trim() && !isHttps(logoUrl)) return setErr('The logo link must start with https://');
    const ord = order.trim() ? Number(order) : undefined;
    if (ord !== undefined && !Number.isInteger(ord)) return setErr('Order must be a whole number (1 shows first).');
    setBusy(true);
    try {
      await savePartner(
        partner?.id,
        { name: name.trim(), kind, blurb: blurb.trim(), website: website.trim(), logoUrl: logoUrl.trim(), order: ord, published },
        { ...priv, contactName: priv.contactName?.trim(), contactEmail: priv.contactEmail?.trim(), contactPhone: priv.contactPhone?.trim(), terms: priv.terms?.trim() },
      );
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the partner.');
    } finally {
      setBusy(false);
    }
  }

  const setP = (k: keyof PartnerPrivate) => (e: { target: { value: string } }) => setPriv((p) => ({ ...p, [k]: e.target.value }));

  return (
    <FormShell title={partner ? `Edit ${partner.name}` : 'Add a partner'} onSubmit={() => void submit()} onCancel={onDone} busy={busy} err={err}>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Shown on the public Partners page</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></Field>
        <Field label="Type">
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as PartnerKind)}>
            {PARTNER_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Field>
        <Field label="Website (https)"><input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></Field>
        <Field label="Logo link (https, their own logo file you have permission to show)"><input className={inputCls} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://" /></Field>
      </div>
      <Field label="Short description (up to 400 characters)"><textarea className={`${inputCls} min-h-24 py-2`} value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={400} /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Display order (1 first)"><input className={`${inputCls} ${mono}`} inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} /></Field>
        <label className="flex min-h-11 items-center gap-2 pt-6 text-sm">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-5" />
          Show on the public Partners page
        </label>
      </div>
      <p className="mt-2 font-mono text-xs uppercase tracking-widest text-muted">Private: hosts and admins only, never shown publicly</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Contact person"><input className={inputCls} value={priv.contactName ?? ''} onChange={setP('contactName')} /></Field>
        <Field label="Contact email"><input className={inputCls} type="email" value={priv.contactEmail ?? ''} onChange={setP('contactEmail')} /></Field>
        <Field label="Contact phone"><input className={inputCls} value={priv.contactPhone ?? ''} onChange={setP('contactPhone')} /></Field>
        <Field label="Partner since"><input className={`${inputCls} ${mono}`} type="date" value={priv.since ?? ''} onChange={setP('since')} /></Field>
      </div>
      <Field label="Deal notes (what was agreed, deliverables, renewal; up to 1000 characters)"><textarea className={`${inputCls} min-h-24 py-2`} value={priv.terms ?? ''} onChange={setP('terms')} maxLength={1000} /></Field>
    </FormShell>
  );
}

function PartnersTab() {
  const { items, err } = useList<Partner>(watchAllPartners);
  const [editing, setEditing] = useState<Partner | 'new' | null>(null);
  const [delErr, setDelErr] = useState('');

  async function remove(p: Partner) {
    if (!window.confirm(`Delete ${p.name}? This also removes the private contact and deal notes.`)) return;
    setDelErr('');
    try {
      await deletePartner(p.id);
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : 'Could not delete.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Partners shown on the public Partners page, with private contact and deal details.</p>
        {!editing && <Button variant="secondary" onClick={() => setEditing('new')}>Add partner</Button>}
      </div>
      {editing && <PartnerForm key={editing === 'new' ? 'new' : editing.id} partner={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      {err && <p role="alert" className="mt-4 text-sm text-accent-text">{err}</p>}
      {delErr && <p role="alert" className="mt-4 text-sm text-accent-text">{delErr}</p>}
      {items === null && !err && <RowsSkeleton />}
      {items && items.length === 0 && !editing && <p className="mt-4 text-sm text-muted">No partners yet. Add the first one above.</p>}
      {items && items.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {items.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.name}</p>
                <p className="text-sm text-muted">{partnerKindLabel(p.kind)}</p>
              </div>
              <StatePill on={p.published} yes="Public" no="Hidden" />
              <Button variant="secondary" className="min-h-11 px-3" onClick={() => setEditing(p)}>Edit</Button>
              <Button variant="ghost" className="min-h-11 px-3" onClick={() => void remove(p)} aria-label={`Delete ${p.name}`}>
                <Trash size={18} weight="regular" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- stories ---------------- */

function StoryForm({ story, onDone }: { story?: Story; onDone: () => void }) {
  const [title, setTitle] = useState(story?.title ?? '');
  const [tag, setTag] = useState<StoryTag>(story?.tag ?? 'recap');
  const [date, setDate] = useState(story?.date ?? today());
  const [summary, setSummary] = useState(story?.summary ?? '');
  const [body, setBody] = useState(story?.body ?? '');
  const [coverUrl, setCoverUrl] = useState(story?.coverUrl ?? '');
  const [published, setPublished] = useState(story?.published ?? false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!title.trim()) return setErr('Enter a title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr('Pick a date.');
    if (coverUrl.trim() && !isHttps(coverUrl)) return setErr('The cover image link must start with https://');
    setBusy(true);
    try {
      await saveStory(story?.id, { title: title.trim(), tag, date, summary: summary.trim(), body: body.trim(), coverUrl: coverUrl.trim(), published });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the story.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell title={story ? 'Edit story' : 'Write a story'} onSubmit={() => void submit()} onCancel={onDone} busy={busy} err={err}>
      <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <select className={inputCls} value={tag} onChange={(e) => setTag(e.target.value as StoryTag)}>
            {STORY_TAGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Date"><input className={`${inputCls} ${mono}`} type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      </div>
      <Field label="Summary shown on the list (up to 300 characters)"><textarea className={`${inputCls} min-h-20 py-2`} value={summary} onChange={(e) => setSummary(e.target.value)} maxLength={300} /></Field>
      <Field label="Story text (plain text; leave a blank line between paragraphs)"><textarea className={`${inputCls} min-h-40 py-2`} value={body} onChange={(e) => setBody(e.target.value)} maxLength={6000} /></Field>
      <Field label="Cover image link (https, a photo you have the right to use)"><input className={inputCls} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://" /></Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} className="size-5" />
        Publish on the public Stories page
      </label>
    </FormShell>
  );
}

function StoriesTab() {
  const { items, err } = useList<Story>(watchAllStories);
  const [editing, setEditing] = useState<Story | 'new' | null>(null);
  const [delErr, setDelErr] = useState('');

  async function remove(s: Story) {
    if (!window.confirm(`Delete "${s.title}"?`)) return;
    setDelErr('');
    try {
      await deleteStory(s.id);
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : 'Could not delete.');
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Race recaps, event stories and news for the public Stories page.</p>
        {!editing && <Button variant="secondary" onClick={() => setEditing('new')}>Write story</Button>}
      </div>
      {editing && <StoryForm key={editing === 'new' ? 'new' : editing.id} story={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />}
      {err && <p role="alert" className="mt-4 text-sm text-accent-text">{err}</p>}
      {delErr && <p role="alert" className="mt-4 text-sm text-accent-text">{delErr}</p>}
      {items === null && !err && <RowsSkeleton />}
      {items && items.length === 0 && !editing && <p className="mt-4 text-sm text-muted">No stories yet.</p>}
      {items && items.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.title}</p>
                <p className={`${mono} text-sm text-muted`}>{storyTagLabel(s.tag)} - {s.date}</p>
              </div>
              <StatePill on={s.published} yes="Published" no="Draft" />
              <Button variant="secondary" className="min-h-11 px-3" onClick={() => setEditing(s)}>Edit</Button>
              <Button variant="ghost" className="min-h-11 px-3" onClick={() => void remove(s)} aria-label={`Delete ${s.title}`}>
                <Trash size={18} weight="regular" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------- legal document register ---------------- */

/** Starting points only: the title and type are pre-filled, the link and where it is stored come from the user. */
const SUGGESTED: { title: string; category: LegalCategory }[] = [
  { title: 'Developer and operator agreement', category: 'agreement' },
  { title: 'OpenF1 written permission', category: 'permission' },
  { title: 'Terms and conditions (reviewed copy)', category: 'policy' },
  { title: 'Privacy policy (reviewed copy)', category: 'policy' },
  { title: 'Business registration / certificate', category: 'registration' },
  { title: 'Venue agreement', category: 'agreement' },
  { title: 'Sponsor agreement', category: 'agreement' },
];

function expiryNote(d?: string): string {
  if (!d) return '';
  const days = Math.floor((Date.parse(`${d}T00:00:00`) - Date.now()) / 86_400_000);
  if (Number.isNaN(days)) return '';
  return days < 0 ? 'Expired' : days <= 30 ? `Expires in ${days} days` : '';
}

function LegalForm({ doc: existing, seed, partners, onDone }: { doc?: LegalDoc; seed?: { title: string; category: LegalCategory }; partners: Partner[]; onDone: () => void }) {
  const [title, setTitle] = useState(existing?.title ?? seed?.title ?? '');
  const [category, setCategory] = useState<LegalCategory>(existing?.category ?? seed?.category ?? 'agreement');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [where, setWhere] = useState(existing?.where ?? '');
  const [partnerId, setPartnerId] = useState(existing?.partnerId ?? '');
  const [signedOn, setSignedOn] = useState(existing?.signedOn ?? '');
  const [expiresOn, setExpiresOn] = useState(existing?.expiresOn ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!title.trim()) return setErr('Enter a title.');
    if (!isHttps(url)) return setErr('Paste the link to the original document. It must start with https://');
    setBusy(true);
    try {
      await saveLegalDoc(existing?.id, { title: title.trim(), category, url: url.trim(), where: where.trim(), partnerId: partnerId || undefined, signedOn, expiresOn, notes: notes.trim() });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the link.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormShell title={existing ? 'Edit document link' : 'Add a document link'} onSubmit={() => void submit()} onCancel={onDone} busy={busy} err={err}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></Field>
        <Field label="Type">
          <select className={inputCls} value={category} onChange={(e) => setCategory(e.target.value as LegalCategory)}>
            {LEGAL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Link to the original (https: Drive, Notion, lawyer portal...)"><input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" required /></Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Where it lives (who holds the original)"><input className={inputCls} value={where} onChange={(e) => setWhere(e.target.value)} maxLength={120} placeholder="e.g. Club Drive, Legal folder" /></Field>
        <Field label="Concerns partner (optional)">
          <select className={inputCls} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
            <option value="">None</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Signed on"><input className={`${inputCls} ${mono}`} type="date" value={signedOn} onChange={(e) => setSignedOn(e.target.value)} /></Field>
        <Field label="Expires / renew by"><input className={`${inputCls} ${mono}`} type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} /></Field>
      </div>
      <Field label="Notes (up to 500 characters)"><textarea className={`${inputCls} min-h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} /></Field>
    </FormShell>
  );
}

function LegalTab() {
  const { items, err } = useList<LegalDoc>(watchLegalDocs);
  const { items: partners } = useList<Partner>(watchAllPartners);
  const [editing, setEditing] = useState<{ doc?: LegalDoc; seed?: { title: string; category: LegalCategory } } | null>(null);
  const [delErr, setDelErr] = useState('');
  const partnerName = useMemo(() => new Map((partners ?? []).map((p) => [p.id, p.name])), [partners]);
  const have = new Set((items ?? []).map((d) => d.title));

  async function remove(d: LegalDoc) {
    if (!window.confirm(`Remove the link to "${d.title}"? The original document is not touched.`)) return;
    setDelErr('');
    try {
      await deleteLegalDoc(d.id);
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : 'Could not remove.');
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <p className="max-w-[60ch] text-sm text-muted">
          One place to find every agreement, licence and permission. Add a link to the original and note who holds it. The files stay where they are.
        </p>
        {!editing && <Button variant="secondary" onClick={() => setEditing({})}>Add link</Button>}
      </div>
      {editing && <LegalForm key={editing.doc?.id ?? editing.seed?.title ?? 'new'} doc={editing.doc} seed={editing.seed} partners={partners ?? []} onDone={() => setEditing(null)} />}
      {!editing && (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested documents">
          {SUGGESTED.filter((s) => !have.has(s.title)).map((s) => (
            <button key={s.title} type="button" onClick={() => setEditing({ seed: s })} className="min-h-11 rounded-full border border-dashed border-line px-3 text-sm text-muted transition hover:border-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
              + {s.title}
            </button>
          ))}
        </div>
      )}
      {err && <p role="alert" className="mt-4 text-sm text-accent-text">{err}</p>}
      {delErr && <p role="alert" className="mt-4 text-sm text-accent-text">{delErr}</p>}
      {items === null && !err && <RowsSkeleton />}
      {items && items.length === 0 && !editing && <p className="mt-4 text-sm text-muted">No documents linked yet. Use the suggestions above to start.</p>}
      {items && items.length > 0 && (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {items.map((d) => {
            const note = expiryNote(d.expiresOn);
            return (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{d.title}</p>
                  <p className="text-sm text-muted">
                    {legalCategoryLabel(d.category)}
                    {d.partnerId && partnerName.get(d.partnerId) ? ` - ${partnerName.get(d.partnerId)}` : ''}
                    {d.where ? ` - held by ${d.where}` : ''}
                  </p>
                  {(d.signedOn || d.expiresOn) && (
                    <p className={`${mono} text-xs text-muted`}>
                      {d.signedOn ? `Signed ${d.signedOn}` : ''}{d.signedOn && d.expiresOn ? ' - ' : ''}{d.expiresOn ? `Renew by ${d.expiresOn}` : ''}
                    </p>
                  )}
                  {note && <p className="text-sm font-medium text-accent-text">{note}</p>}
                </div>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  Open original<ArrowSquareOut size={16} weight="regular" aria-hidden="true" />
                  <span className="sr-only"> {d.title} (opens in a new tab)</span>
                </a>
                <Button variant="secondary" className="min-h-11 px-3" onClick={() => setEditing({ doc: d })}>Edit</Button>
                <Button variant="ghost" className="min-h-11 px-3" onClick={() => void remove(d)} aria-label={`Remove link to ${d.title}`}>
                  <Trash size={18} weight="regular" aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

type Tab = 'partners' | 'stories' | 'legal';

export { PartnerForm, StoryForm, LegalForm };

export default function ContentAdmin() {
  const { access } = useAuth();
  const [tab, setTab] = useState<Tab>('partners');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'partners', label: 'Partners' },
    { id: 'stories', label: 'Stories' },
    ...(access?.isAdmin ? [{ id: 'legal' as Tab, label: 'Legal documents' }] : []),
  ];

  return (
    <section aria-label="Content" className="py-6">
      <h2 className="text-2xl font-semibold md:text-3xl">Content</h2>
      <div role="tablist" aria-label="Content sections" className="mt-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 rounded-full border px-4 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              tab === t.id ? 'border-accent text-ink' : 'border-line text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-6" role="tabpanel">
        {tab === 'partners' && <PartnersTab />}
        {tab === 'stories' && <StoriesTab />}
        {tab === 'legal' && access?.isAdmin && <LegalTab />}
      </div>
    </section>
  );
}
