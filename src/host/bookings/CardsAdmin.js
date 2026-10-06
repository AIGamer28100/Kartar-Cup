import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import { updateBookingEvent } from '../../lib/bookings';
import { cardImageSrc, deleteCard, fileToCardImage, saveCard, watchCards } from '../../lib/cards';
import { inputCls } from '../settings/ui';
const num = 'font-mono tabular-nums';
const lbl = 'block text-sm text-muted';
function Preview({ card }) {
    const src = cardImageSrc(card);
    return src ? (_jsx("img", { src: src, alt: "", loading: "lazy", className: "h-28 w-auto rounded-md border border-line object-contain" })) : (_jsx("span", { className: "flex h-28 w-20 items-center justify-center rounded-md border border-dashed border-line text-xs text-muted", children: "No image" }));
}
/** One design: a VIP pass or a Play card. The image is a CDN link (preferred, e.g. Cloudflare R2) or an
 * uploaded file that is compressed and stored inline, because Firebase Storage is not set up (R45). */
function CardForm({ eventId, kind, card, nextOrder, onDone, }) {
    const [driverName, setDriverName] = useState(card?.driverName ?? '');
    const [code, setCode] = useState(card?.code ?? '');
    const [number, setNumber] = useState(card?.number != null ? String(card.number) : '');
    const [points, setPoints] = useState(card?.points != null ? String(card.points) : '');
    const [title, setTitle] = useState(card?.title ?? (kind === 'vip' ? 'VIP Guest' : ''));
    const [imageUrl, setImageUrl] = useState(card?.imageUrl ?? '');
    const [image, setImage] = useState(card?.image ?? '');
    const [dims, setDims] = useState({ w: card?.width, h: card?.height });
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    async function pick(file) {
        if (!file)
            return;
        setErr('');
        setBusy(true);
        try {
            const r = await fileToCardImage(file);
            setImage(r.image);
            setImageUrl('');
            setDims({ w: r.width, h: r.height });
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not read that image.');
        }
        finally {
            setBusy(false);
        }
    }
    async function submit(ev) {
        ev.preventDefault();
        setErr('');
        const url = imageUrl.trim();
        if (!url && !image)
            return setErr('Add an image: paste a https link or upload a file.');
        if (url && !/^https:\/\//i.test(url))
            return setErr('The image link must start with https://');
        const input = {
            id: card?.id ?? (kind === 'vip' ? 'vip' : undefined),
            kind,
            title: title.trim() || undefined,
            imageUrl: url || undefined,
            image: url ? undefined : image || undefined,
            width: dims.w,
            height: dims.h,
            order: card?.order ?? (kind === 'vip' ? 0 : nextOrder),
        };
        if (kind === 'play') {
            const p = Number(points);
            if (!driverName.trim())
                return setErr('Enter the driver name.');
            if (!Number.isInteger(p) || p < 0 || p > 1000)
                return setErr('Points must be a whole number from 0 to 1000.');
            input.driverName = driverName.trim();
            input.code = code.trim().toUpperCase().slice(0, 4) || undefined;
            input.number = number.trim() ? Number(number) : undefined;
            input.points = p;
        }
        setBusy(true);
        try {
            await saveCard(eventId, input);
            onDone();
        }
        catch (e) {
            setErr(e instanceof Error ? e.message : 'Could not save the card.');
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("form", { onSubmit: submit, className: "grid gap-3 rounded-lg border border-line p-4", children: [_jsxs("p", { className: "font-medium", children: [card ? 'Edit' : 'Add', " ", kind === 'vip' ? 'VIP pass design' : 'Play card'] }), kind === 'play' ? (_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("label", { className: lbl, children: ["Driver name", _jsx("input", { className: `${inputCls} mt-1`, value: driverName, onChange: (e) => setDriverName(e.target.value), maxLength: 60, required: true })] }), _jsxs("label", { className: lbl, children: ["Points on the card", _jsx("input", { className: `${inputCls} ${num} mt-1`, inputMode: "numeric", value: points, onChange: (e) => setPoints(e.target.value), required: true })] }), _jsxs("label", { className: lbl, children: ["Timing code (e.g. LEC)", _jsx("input", { className: `${inputCls} mt-1 uppercase`, value: code, onChange: (e) => setCode(e.target.value), maxLength: 4 })] }), _jsxs("label", { className: lbl, children: ["Car number", _jsx("input", { className: `${inputCls} ${num} mt-1`, inputMode: "numeric", value: number, onChange: (e) => setNumber(e.target.value) })] })] })) : (_jsxs("label", { className: lbl, children: ["Label (optional)", _jsx("input", { className: `${inputCls} mt-1`, value: title, onChange: (e) => setTitle(e.target.value), maxLength: 60 })] })), _jsxs("label", { className: lbl, children: ["Image link (https, e.g. your Cloudflare R2 / CDN URL) - preferred", _jsx("input", { className: `${inputCls} mt-1`, value: imageUrl, onChange: (e) => setImageUrl(e.target.value), placeholder: "https://cdn.example.com/card-8f3k2.webp" })] }), _jsxs("label", { className: lbl, children: ["...or upload a file (compressed and stored with the event)", _jsx("input", { type: "file", accept: "image/*", className: "mt-1 block text-sm", disabled: busy, onChange: (e) => void pick(e.target.files?.[0]) })] }), _jsxs("div", { className: "flex items-end gap-4", children: [_jsx(Preview, { card: { image: imageUrl.trim() ? undefined : image, imageUrl: imageUrl.trim() || undefined } }), dims.w && dims.h && _jsxs("p", { className: `${num} text-xs text-muted`, children: [dims.w, " x ", dims.h, "px"] })] }), err && _jsx("p", { role: "alert", className: "text-sm text-accent-text", children: err }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", disabled: busy, children: busy ? 'Saving...' : 'Save' }), _jsx(Button, { variant: "ghost", onClick: onDone, disabled: busy, children: "Cancel" })] })] }));
}
/** Host: card designs for one booking event (R45) - print size, the VIP pass design and one Play card
 * per driver with its points. Designs differ per race, so the host sets all of this before each event. */
export default function CardsAdmin({ event, onBack }) {
    const [cards, setCards] = useState(null);
    const [loadErr, setLoadErr] = useState('');
    const [editing, setEditing] = useState(null);
    const [w, setW] = useState(event.cardSpec?.widthMm != null ? String(event.cardSpec.widthMm) : '');
    const [h, setH] = useState(event.cardSpec?.heightMm != null ? String(event.cardSpec.heightMm) : '');
    const [note, setNote] = useState(event.cardSpec?.note ?? '');
    const [specMsg, setSpecMsg] = useState('');
    const [delErr, setDelErr] = useState('');
    useEffect(() => watchCards(event.id, setCards, (e) => setLoadErr(e.message)), [event.id]);
    const vip = cards?.find((c) => c.kind === 'vip');
    const plays = (cards ?? []).filter((c) => c.kind === 'play');
    const nextOrder = (cards ?? []).reduce((m, c) => Math.max(m, c.order), 0) + 1;
    async function saveSpec(ev) {
        ev.preventDefault();
        setSpecMsg('');
        const spec = {
            ...(w.trim() ? { widthMm: Number(w) } : {}),
            ...(h.trim() ? { heightMm: Number(h) } : {}),
            ...(note.trim() ? { note: note.trim().slice(0, 200) } : {}),
        };
        if ((spec.widthMm != null && !(spec.widthMm > 0)) || (spec.heightMm != null && !(spec.heightMm > 0))) {
            return setSpecMsg('Sizes must be positive numbers in millimetres.');
        }
        try {
            await updateBookingEvent(event.id, { cardSpec: spec });
            setSpecMsg('Saved.');
        }
        catch (e) {
            setSpecMsg(e instanceof Error ? e.message : 'Could not save.');
        }
    }
    async function remove(c) {
        if (!window.confirm(`Delete the ${c.driverName ?? c.title ?? 'card'} design? Guests who already drew it keep their copy.`))
            return;
        setDelErr('');
        try {
            await deleteCard(event.id, c.id);
        }
        catch (e) {
            setDelErr(e instanceof Error ? e.message : 'Could not delete.');
        }
    }
    return (_jsxs("div", { className: "py-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsxs(Button, { variant: "ghost", onClick: onBack, "aria-label": "Back to events", children: [_jsx(ArrowLeft, { size: 20, weight: "regular", "aria-hidden": "true" }), "Back"] }), _jsxs("div", { className: "min-w-0", children: [_jsxs("h2", { className: "truncate text-lg font-medium", children: ["Cards - ", event.title] }), _jsx("p", { className: "text-sm text-muted", children: "VIP pass and Play cards for this event. Upload every design before the event." })] })] }), _jsxs("form", { onSubmit: saveSpec, className: "mt-6 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[8rem_8rem_1fr_auto] sm:items-end", children: [_jsxs("label", { className: lbl, children: ["Width (mm)", _jsx("input", { className: `${inputCls} ${num} mt-1`, inputMode: "decimal", value: w, onChange: (e) => setW(e.target.value) })] }), _jsxs("label", { className: lbl, children: ["Height (mm)", _jsx("input", { className: `${inputCls} ${num} mt-1`, inputMode: "decimal", value: h, onChange: (e) => setH(e.target.value) })] }), _jsxs("label", { className: lbl, children: ["Print note", _jsx("input", { className: `${inputCls} mt-1`, value: note, onChange: (e) => setNote(e.target.value), maxLength: 200, placeholder: "e.g. matte, rounded corners" })] }), _jsx(Button, { type: "submit", variant: "secondary", children: "Save size" }), specMsg && _jsx("p", { role: "status", className: "text-sm text-muted sm:col-span-4", children: specMsg })] }), loadErr && _jsx("p", { role: "alert", className: "mt-4 text-sm text-accent-text", children: loadErr }), cards === null && !loadErr && _jsx(RowsSkeleton, {}), cards !== null && (_jsxs(_Fragment, { children: [_jsx("h3", { className: "mt-8 font-medium", children: "VIP pass design" }), editing?.kind === 'vip' ? (_jsx("div", { className: "mt-3", children: _jsx(CardForm, { eventId: event.id, kind: "vip", card: vip, nextOrder: 0, onDone: () => setEditing(null) }) })) : (_jsxs("div", { className: "mt-3 flex items-center gap-4", children: [vip ? _jsx(Preview, { card: vip }) : _jsx("p", { className: "text-sm text-muted", children: "No VIP pass design yet." }), _jsx(Button, { variant: "secondary", onClick: () => setEditing({ kind: 'vip', card: vip }), children: vip ? 'Replace' : 'Add VIP design' })] })), _jsxs("div", { className: "mt-8 flex items-center justify-between gap-3", children: [_jsxs("h3", { className: "font-medium", children: ["Play cards ", _jsxs("span", { className: `${num} text-muted`, children: ["(", plays.length, ")"] })] }), !editing && _jsx(Button, { variant: "secondary", onClick: () => setEditing({ kind: 'play' }), children: "Add Play card" })] }), editing?.kind === 'play' && (_jsx("div", { className: "mt-3", children: _jsx(CardForm, { eventId: event.id, kind: "play", card: editing.card, nextOrder: nextOrder, onDone: () => setEditing(null) }, editing.card?.id ?? 'new') })), delErr && _jsx("p", { role: "alert", className: "mt-3 text-sm text-accent-text", children: delErr }), plays.length === 0 && !editing ? (_jsx("p", { className: "mt-3 text-sm text-muted", children: "No Play cards yet. Add one per driver in the deck, with the points printed on it." })) : (_jsx("ul", { className: "mt-3 grid gap-3 sm:grid-cols-2", children: plays.map((c) => (_jsxs("li", { className: "flex items-center gap-3 rounded-lg border border-line p-3", children: [_jsx(Preview, { card: c }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "truncate font-medium", children: c.driverName }), _jsxs("p", { className: `${num} text-sm text-muted`, children: [c.code ?? '', c.number != null ? ` #${c.number}` : '', " - ", c.points, " pts"] })] }), _jsxs("div", { className: "flex flex-col gap-2", children: [_jsx(Button, { variant: "secondary", className: "min-h-11 px-3", onClick: () => setEditing({ kind: 'play', card: c }), children: "Edit" }), _jsx(Button, { variant: "ghost", className: "min-h-11 px-3", onClick: () => void remove(c), "aria-label": `Delete ${c.driverName}`, children: _jsx(Trash, { size: 18, weight: "regular", "aria-hidden": "true" }) })] })] }, c.id))) }))] }))] }));
}
