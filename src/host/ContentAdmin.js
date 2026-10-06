import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { ArrowSquareOut, Trash } from '@phosphor-icons/react';
import Button from '../components/Button';
import { RowsSkeleton } from '../components/Skeleton';
import { useAuth } from '../lib/auth';
import { LEGAL_CATEGORIES, PARTNER_KINDS, STORY_TAGS, deleteLegalDoc, deletePartner, deleteStory, getPartnerPrivate, isHttps, legalCategoryLabel, partnerKindLabel, saveLegalDoc, savePartner, saveStory, storyTagLabel, watchAllPartners, watchAllStories, watchLegalDocs, } from '../lib/content';
import { inputCls } from './settings/ui';
/* Host > Content: partners, stories and the legal-document register in one place. The register holds LINKS to
 * the originals (wherever they live: Drive, Notion, a lawyer's portal) so nobody has to hunt through personal
 * storage when an issue comes up; the files themselves are never copied here. Admins only for the register. */
const lbl = 'block text-sm text-muted';
const mono = 'font-mono tabular-nums';
const today = () => new Date().toISOString().slice(0, 10);
function Field({ label, children }) {
    return (_jsxs("label", { className: lbl, children: [label, _jsx("div", { className: "mt-1", children: children })] }));
}
function FormShell({ title, onSubmit, onCancel, busy, err, children }) {
    return (_jsxs("form", { onSubmit: (e) => {
            e.preventDefault();
            onSubmit();
        }, className: "mt-4 grid gap-3 rounded-lg border border-line p-4", children: [_jsx("p", { className: "font-medium", children: title }), children, err && _jsx("p", { role: "alert", className: "text-sm text-accent-text", children: err }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", disabled: busy, children: busy ? 'Saving...' : 'Save' }), _jsx(Button, { variant: "ghost", onClick: onCancel, disabled: busy, children: "Cancel" })] })] }));
}
function useList(watch) {
    const [items, setItems] = useState(null);
    const [err, setErr] = useState('');
    useEffect(() => watch(setItems, (e) => setErr(e.message)), [watch]);
    return { items, err };
}
const StatePill = ({ on, yes, no }) => (_jsx("span", { className: `inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-medium ${on ? 'bg-accent/15 text-accent-text' : 'bg-raised text-muted'}`, children: on ? yes : no }));
/* ---------------- partners ---------------- */
function PartnerForm({ partner, onDone }) {
    const [name, setName] = useState(partner?.name ?? '');
    const [kind, setKind] = useState(partner?.kind ?? 'sponsor');
    const [blurb, setBlurb] = useState(partner?.blurb ?? '');
    const [website, setWebsite] = useState(partner?.website ?? '');
    const [logoUrl, setLogoUrl] = useState(partner?.logoUrl ?? '');
    const [order, setOrder] = useState(partner?.order != null ? String(partner.order) : '');
    const [published, setPublished] = useState(partner?.published ?? false);
    const [priv, setPriv] = useState({});
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    useEffect(() => {
        if (partner)
            void getPartnerPrivate(partner.id).then(setPriv).catch(() => undefined);
    }, [partner]);
    async function submit() {
        setErr('');
        if (!name.trim())
            return setErr('Enter the partner name.');
        if (website.trim() && !isHttps(website))
            return setErr('The website must start with https://');
        if (logoUrl.trim() && !isHttps(logoUrl))
            return setErr('The logo link must start with https://');
        const ord = order.trim() ? Number(order) : undefined;
        if (ord !== undefined && !Number.isInteger(ord))
            return setErr('Order must be a whole number (1 shows first).');
        setBusy(true);
        try {
            await savePartner(partner?.id, { name: name.trim(), kind, blurb: blurb.trim(), website: website.trim(), logoUrl: logoUrl.trim(), order: ord, published }, { ...priv, contactName: priv.contactName?.trim(), contactEmail: priv.contactEmail?.trim(), contactPhone: priv.contactPhone?.trim(), terms: priv.terms?.trim() });
            onDone();
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not save the partner.');
        }
        finally {
            setBusy(false);
        }
    }
    const setP = (k) => (e) => setPriv((p) => ({ ...p, [k]: e.target.value }));
    return (_jsxs(FormShell, { title: partner ? `Edit ${partner.name}` : 'Add a partner', onSubmit: () => void submit(), onCancel: onDone, busy: busy, err: err, children: [_jsx("p", { className: "font-mono text-xs uppercase tracking-widest text-muted", children: "Shown on the public Partners page" }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Name", children: _jsx("input", { className: inputCls, value: name, onChange: (e) => setName(e.target.value), maxLength: 80, required: true }) }), _jsx(Field, { label: "Type", children: _jsx("select", { className: inputCls, value: kind, onChange: (e) => setKind(e.target.value), children: PARTNER_KINDS.map((k) => _jsx("option", { value: k.id, children: k.label }, k.id)) }) }), _jsx(Field, { label: "Website (https)", children: _jsx("input", { className: inputCls, value: website, onChange: (e) => setWebsite(e.target.value), placeholder: "https://" }) }), _jsx(Field, { label: "Logo link (https, their own logo file you have permission to show)", children: _jsx("input", { className: inputCls, value: logoUrl, onChange: (e) => setLogoUrl(e.target.value), placeholder: "https://" }) })] }), _jsx(Field, { label: "Short description (up to 400 characters)", children: _jsx("textarea", { className: `${inputCls} min-h-24 py-2`, value: blurb, onChange: (e) => setBlurb(e.target.value), maxLength: 400 }) }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Display order (1 first)", children: _jsx("input", { className: `${inputCls} ${mono}`, inputMode: "numeric", value: order, onChange: (e) => setOrder(e.target.value) }) }), _jsxs("label", { className: "flex min-h-11 items-center gap-2 pt-6 text-sm", children: [_jsx("input", { type: "checkbox", checked: published, onChange: (e) => setPublished(e.target.checked), className: "size-5" }), "Show on the public Partners page"] })] }), _jsx("p", { className: "mt-2 font-mono text-xs uppercase tracking-widest text-muted", children: "Private: hosts and admins only, never shown publicly" }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Contact person", children: _jsx("input", { className: inputCls, value: priv.contactName ?? '', onChange: setP('contactName') }) }), _jsx(Field, { label: "Contact email", children: _jsx("input", { className: inputCls, type: "email", value: priv.contactEmail ?? '', onChange: setP('contactEmail') }) }), _jsx(Field, { label: "Contact phone", children: _jsx("input", { className: inputCls, value: priv.contactPhone ?? '', onChange: setP('contactPhone') }) }), _jsx(Field, { label: "Partner since", children: _jsx("input", { className: `${inputCls} ${mono}`, type: "date", value: priv.since ?? '', onChange: setP('since') }) })] }), _jsx(Field, { label: "Deal notes (what was agreed, deliverables, renewal; up to 1000 characters)", children: _jsx("textarea", { className: `${inputCls} min-h-24 py-2`, value: priv.terms ?? '', onChange: setP('terms'), maxLength: 1000 }) })] }));
}
function PartnersTab() {
    const { items, err } = useList(watchAllPartners);
    const [editing, setEditing] = useState(null);
    const [delErr, setDelErr] = useState('');
    async function remove(p) {
        if (!window.confirm(`Delete ${p.name}? This also removes the private contact and deal notes.`))
            return;
        setDelErr('');
        try {
            await deletePartner(p.id);
        }
        catch (e) {
            setDelErr(e instanceof Error ? e.message : 'Could not delete.');
        }
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("p", { className: "text-sm text-muted", children: "Partners shown on the public Partners page, with private contact and deal details." }), !editing && _jsx(Button, { variant: "secondary", onClick: () => setEditing('new'), children: "Add partner" })] }), editing && _jsx(PartnerForm, { partner: editing === 'new' ? undefined : editing, onDone: () => setEditing(null) }, editing === 'new' ? 'new' : editing.id), err && _jsx("p", { role: "alert", className: "mt-4 text-sm text-accent-text", children: err }), delErr && _jsx("p", { role: "alert", className: "mt-4 text-sm text-accent-text", children: delErr }), items === null && !err && _jsx(RowsSkeleton, {}), items && items.length === 0 && !editing && _jsx("p", { className: "mt-4 text-sm text-muted", children: "No partners yet. Add the first one above." }), items && items.length > 0 && (_jsx("ul", { className: "mt-4 divide-y divide-line border-y border-line", children: items.map((p) => (_jsxs("li", { className: "flex flex-wrap items-center gap-3 py-3", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-medium", children: p.name }), _jsx("p", { className: "text-sm text-muted", children: partnerKindLabel(p.kind) })] }), _jsx(StatePill, { on: p.published, yes: "Public", no: "Hidden" }), _jsx(Button, { variant: "secondary", className: "min-h-11 px-3", onClick: () => setEditing(p), children: "Edit" }), _jsx(Button, { variant: "ghost", className: "min-h-11 px-3", onClick: () => void remove(p), "aria-label": `Delete ${p.name}`, children: _jsx(Trash, { size: 18, weight: "regular", "aria-hidden": "true" }) })] }, p.id))) }))] }));
}
/* ---------------- stories ---------------- */
function StoryForm({ story, onDone }) {
    const [title, setTitle] = useState(story?.title ?? '');
    const [tag, setTag] = useState(story?.tag ?? 'recap');
    const [date, setDate] = useState(story?.date ?? today());
    const [summary, setSummary] = useState(story?.summary ?? '');
    const [body, setBody] = useState(story?.body ?? '');
    const [coverUrl, setCoverUrl] = useState(story?.coverUrl ?? '');
    const [published, setPublished] = useState(story?.published ?? false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    async function submit() {
        setErr('');
        if (!title.trim())
            return setErr('Enter a title.');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
            return setErr('Pick a date.');
        if (coverUrl.trim() && !isHttps(coverUrl))
            return setErr('The cover image link must start with https://');
        setBusy(true);
        try {
            await saveStory(story?.id, { title: title.trim(), tag, date, summary: summary.trim(), body: body.trim(), coverUrl: coverUrl.trim(), published });
            onDone();
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not save the story.');
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs(FormShell, { title: story ? 'Edit story' : 'Write a story', onSubmit: () => void submit(), onCancel: onDone, busy: busy, err: err, children: [_jsx(Field, { label: "Title", children: _jsx("input", { className: inputCls, value: title, onChange: (e) => setTitle(e.target.value), maxLength: 120, required: true }) }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Type", children: _jsx("select", { className: inputCls, value: tag, onChange: (e) => setTag(e.target.value), children: STORY_TAGS.map((t) => _jsx("option", { value: t.id, children: t.label }, t.id)) }) }), _jsx(Field, { label: "Date", children: _jsx("input", { className: `${inputCls} ${mono}`, type: "date", value: date, onChange: (e) => setDate(e.target.value), required: true }) })] }), _jsx(Field, { label: "Summary shown on the list (up to 300 characters)", children: _jsx("textarea", { className: `${inputCls} min-h-20 py-2`, value: summary, onChange: (e) => setSummary(e.target.value), maxLength: 300 }) }), _jsx(Field, { label: "Story text (plain text; leave a blank line between paragraphs)", children: _jsx("textarea", { className: `${inputCls} min-h-40 py-2`, value: body, onChange: (e) => setBody(e.target.value), maxLength: 6000 }) }), _jsx(Field, { label: "Cover image link (https, a photo you have the right to use)", children: _jsx("input", { className: inputCls, value: coverUrl, onChange: (e) => setCoverUrl(e.target.value), placeholder: "https://" }) }), _jsxs("label", { className: "flex min-h-11 items-center gap-2 text-sm", children: [_jsx("input", { type: "checkbox", checked: published, onChange: (e) => setPublished(e.target.checked), className: "size-5" }), "Publish on the public Stories page"] })] }));
}
function StoriesTab() {
    const { items, err } = useList(watchAllStories);
    const [editing, setEditing] = useState(null);
    const [delErr, setDelErr] = useState('');
    async function remove(s) {
        if (!window.confirm(`Delete "${s.title}"?`))
            return;
        setDelErr('');
        try {
            await deleteStory(s.id);
        }
        catch (e) {
            setDelErr(e instanceof Error ? e.message : 'Could not delete.');
        }
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsx("p", { className: "text-sm text-muted", children: "Race recaps, event stories and news for the public Stories page." }), !editing && _jsx(Button, { variant: "secondary", onClick: () => setEditing('new'), children: "Write story" })] }), editing && _jsx(StoryForm, { story: editing === 'new' ? undefined : editing, onDone: () => setEditing(null) }, editing === 'new' ? 'new' : editing.id), err && _jsx("p", { role: "alert", className: "mt-4 text-sm text-accent-text", children: err }), delErr && _jsx("p", { role: "alert", className: "mt-4 text-sm text-accent-text", children: delErr }), items === null && !err && _jsx(RowsSkeleton, {}), items && items.length === 0 && !editing && _jsx("p", { className: "mt-4 text-sm text-muted", children: "No stories yet." }), items && items.length > 0 && (_jsx("ul", { className: "mt-4 divide-y divide-line border-y border-line", children: items.map((s) => (_jsxs("li", { className: "flex flex-wrap items-center gap-3 py-3", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-medium", children: s.title }), _jsxs("p", { className: `${mono} text-sm text-muted`, children: [storyTagLabel(s.tag), " - ", s.date] })] }), _jsx(StatePill, { on: s.published, yes: "Published", no: "Draft" }), _jsx(Button, { variant: "secondary", className: "min-h-11 px-3", onClick: () => setEditing(s), children: "Edit" }), _jsx(Button, { variant: "ghost", className: "min-h-11 px-3", onClick: () => void remove(s), "aria-label": `Delete ${s.title}`, children: _jsx(Trash, { size: 18, weight: "regular", "aria-hidden": "true" }) })] }, s.id))) }))] }));
}
/* ---------------- legal document register ---------------- */
/** Starting points only: the title and type are pre-filled, the link and where it is stored come from the user. */
const SUGGESTED = [
    { title: 'Developer and operator agreement', category: 'agreement' },
    { title: 'OpenF1 written permission', category: 'permission' },
    { title: 'Terms and conditions (reviewed copy)', category: 'policy' },
    { title: 'Privacy policy (reviewed copy)', category: 'policy' },
    { title: 'Business registration / certificate', category: 'registration' },
    { title: 'Venue agreement', category: 'agreement' },
    { title: 'Sponsor agreement', category: 'agreement' },
];
function expiryNote(d) {
    if (!d)
        return '';
    const days = Math.floor((Date.parse(`${d}T00:00:00`) - Date.now()) / 86_400_000);
    if (Number.isNaN(days))
        return '';
    return days < 0 ? 'Expired' : days <= 30 ? `Expires in ${days} days` : '';
}
function LegalForm({ doc: existing, seed, partners, onDone }) {
    const [title, setTitle] = useState(existing?.title ?? seed?.title ?? '');
    const [category, setCategory] = useState(existing?.category ?? seed?.category ?? 'agreement');
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
        if (!title.trim())
            return setErr('Enter a title.');
        if (!isHttps(url))
            return setErr('Paste the link to the original document. It must start with https://');
        setBusy(true);
        try {
            await saveLegalDoc(existing?.id, { title: title.trim(), category, url: url.trim(), where: where.trim(), partnerId: partnerId || undefined, signedOn, expiresOn, notes: notes.trim() });
            onDone();
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not save the link.');
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs(FormShell, { title: existing ? 'Edit document link' : 'Add a document link', onSubmit: () => void submit(), onCancel: onDone, busy: busy, err: err, children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Title", children: _jsx("input", { className: inputCls, value: title, onChange: (e) => setTitle(e.target.value), maxLength: 120, required: true }) }), _jsx(Field, { label: "Type", children: _jsx("select", { className: inputCls, value: category, onChange: (e) => setCategory(e.target.value), children: LEGAL_CATEGORIES.map((c) => _jsx("option", { value: c.id, children: c.label }, c.id)) }) })] }), _jsx(Field, { label: "Link to the original (https: Drive, Notion, lawyer portal...)", children: _jsx("input", { className: inputCls, value: url, onChange: (e) => setUrl(e.target.value), placeholder: "https://", required: true }) }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Where it lives (who holds the original)", children: _jsx("input", { className: inputCls, value: where, onChange: (e) => setWhere(e.target.value), maxLength: 120, placeholder: "e.g. Club Drive, Legal folder" }) }), _jsx(Field, { label: "Concerns partner (optional)", children: _jsxs("select", { className: inputCls, value: partnerId, onChange: (e) => setPartnerId(e.target.value), children: [_jsx("option", { value: "", children: "None" }), partners.map((p) => _jsx("option", { value: p.id, children: p.name }, p.id))] }) }), _jsx(Field, { label: "Signed on", children: _jsx("input", { className: `${inputCls} ${mono}`, type: "date", value: signedOn, onChange: (e) => setSignedOn(e.target.value) }) }), _jsx(Field, { label: "Expires / renew by", children: _jsx("input", { className: `${inputCls} ${mono}`, type: "date", value: expiresOn, onChange: (e) => setExpiresOn(e.target.value) }) })] }), _jsx(Field, { label: "Notes (up to 500 characters)", children: _jsx("textarea", { className: `${inputCls} min-h-20 py-2`, value: notes, onChange: (e) => setNotes(e.target.value), maxLength: 500 }) })] }));
}
function LegalTab() {
    const { items, err } = useList(watchLegalDocs);
    const { items: partners } = useList(watchAllPartners);
    const [editing, setEditing] = useState(null);
    const [delErr, setDelErr] = useState('');
    const partnerName = useMemo(() => new Map((partners ?? []).map((p) => [p.id, p.name])), [partners]);
    const have = new Set((items ?? []).map((d) => d.title));
    async function remove(d) {
        if (!window.confirm(`Remove the link to "${d.title}"? The original document is not touched.`))
            return;
        setDelErr('');
        try {
            await deleteLegalDoc(d.id);
        }
        catch (e) {
            setDelErr(e instanceof Error ? e.message : 'Could not remove.');
        }
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsx("p", { className: "max-w-[60ch] text-sm text-muted", children: "One place to find every agreement, licence and permission. Add a link to the original and note who holds it. The files stay where they are." }), !editing && _jsx(Button, { variant: "secondary", onClick: () => setEditing({}), children: "Add link" })] }), editing && _jsx(LegalForm, { doc: editing.doc, seed: editing.seed, partners: partners ?? [], onDone: () => setEditing(null) }, editing.doc?.id ?? editing.seed?.title ?? 'new'), !editing && (_jsx("div", { className: "mt-3 flex flex-wrap gap-2", "aria-label": "Suggested documents", children: SUGGESTED.filter((s) => !have.has(s.title)).map((s) => (_jsxs("button", { type: "button", onClick: () => setEditing({ seed: s }), className: "min-h-11 rounded-full border border-dashed border-line px-3 text-sm text-muted transition hover:border-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", children: ["+ ", s.title] }, s.title))) })), err && _jsx("p", { role: "alert", className: "mt-4 text-sm text-accent-text", children: err }), delErr && _jsx("p", { role: "alert", className: "mt-4 text-sm text-accent-text", children: delErr }), items === null && !err && _jsx(RowsSkeleton, {}), items && items.length === 0 && !editing && _jsx("p", { className: "mt-4 text-sm text-muted", children: "No documents linked yet. Use the suggestions above to start." }), items && items.length > 0 && (_jsx("ul", { className: "mt-4 divide-y divide-line border-y border-line", children: items.map((d) => {
                    const note = expiryNote(d.expiresOn);
                    return (_jsxs("li", { className: "flex flex-wrap items-center gap-3 py-3", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "font-medium", children: d.title }), _jsxs("p", { className: "text-sm text-muted", children: [legalCategoryLabel(d.category), d.partnerId && partnerName.get(d.partnerId) ? ` - ${partnerName.get(d.partnerId)}` : '', d.where ? ` - held by ${d.where}` : ''] }), (d.signedOn || d.expiresOn) && (_jsxs("p", { className: `${mono} text-xs text-muted`, children: [d.signedOn ? `Signed ${d.signedOn}` : '', d.signedOn && d.expiresOn ? ' - ' : '', d.expiresOn ? `Renew by ${d.expiresOn}` : ''] })), note && _jsx("p", { className: "text-sm font-medium text-accent-text", children: note })] }), _jsxs("a", { href: d.url, target: "_blank", rel: "noopener noreferrer", className: "inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-line px-3 text-sm hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent", children: ["Open original", _jsx(ArrowSquareOut, { size: 16, weight: "regular", "aria-hidden": "true" }), _jsxs("span", { className: "sr-only", children: [" ", d.title, " (opens in a new tab)"] })] }), _jsx(Button, { variant: "secondary", className: "min-h-11 px-3", onClick: () => setEditing({ doc: d }), children: "Edit" }), _jsx(Button, { variant: "ghost", className: "min-h-11 px-3", onClick: () => void remove(d), "aria-label": `Remove link to ${d.title}`, children: _jsx(Trash, { size: 18, weight: "regular", "aria-hidden": "true" }) })] }, d.id));
                }) }))] }));
}
export { PartnerForm, StoryForm, LegalForm };
export default function ContentAdmin() {
    const { access } = useAuth();
    const [tab, setTab] = useState('partners');
    const tabs = [
        { id: 'partners', label: 'Partners' },
        { id: 'stories', label: 'Stories' },
        ...(access?.isAdmin ? [{ id: 'legal', label: 'Legal documents' }] : []),
    ];
    return (_jsxs("section", { "aria-label": "Content", className: "py-6", children: [_jsx("h2", { className: "text-2xl font-semibold md:text-3xl", children: "Content" }), _jsx("div", { role: "tablist", "aria-label": "Content sections", className: "mt-4 flex flex-wrap gap-2", children: tabs.map((t) => (_jsx("button", { type: "button", role: "tab", "aria-selected": tab === t.id, onClick: () => setTab(t.id), className: `min-h-11 rounded-full border px-4 text-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${tab === t.id ? 'border-accent text-ink' : 'border-line text-muted hover:text-ink'}`, children: t.label }, t.id))) }), _jsxs("div", { className: "mt-6", role: "tabpanel", children: [tab === 'partners' && _jsx(PartnersTab, {}), tab === 'stories' && _jsx(StoriesTab, {}), tab === 'legal' && access?.isAdmin && _jsx(LegalTab, {})] })] }));
}
