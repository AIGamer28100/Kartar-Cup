import { useEffect, useState } from 'react';
import { ArrowLeft, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import { updateBookingEvent } from '../../lib/bookings';
import { cardImageSrc, deleteCard, fileToCardImage, saveCard, watchCards, type CardInput } from '../../lib/cards';
import type { BookingEvent, CardDoc, CardKind } from '../../lib/types';
import { inputCls } from '../settings/ui';

const num = 'font-mono tabular-nums';
const lbl = 'block text-sm text-muted';

function Preview({ card }: { card: Pick<CardDoc, 'image' | 'imageUrl'> }) {
  const src = cardImageSrc(card);
  return src ? (
    <img src={src} alt="" loading="lazy" className="h-28 w-auto rounded-md border border-line object-contain" />
  ) : (
    <span className="flex h-28 w-20 items-center justify-center rounded-md border border-dashed border-line text-xs text-muted">
      No image
    </span>
  );
}

/** One design: a VIP pass or a Play card. The image is a CDN link (preferred, e.g. Cloudflare R2) or an
 * uploaded file that is compressed and stored inline, because Firebase Storage is not set up (R45). */
function CardForm({
  eventId,
  kind,
  card,
  nextOrder,
  onDone,
}: {
  eventId: string;
  kind: CardKind;
  card?: CardDoc;
  nextOrder: number;
  onDone: () => void;
}) {
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

  async function pick(file: File | undefined) {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const r = await fileToCardImage(file);
      setImage(r.image);
      setImageUrl('');
      setDims({ w: r.width, h: r.height });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setErr('');
    const url = imageUrl.trim();
    if (!url && !image) return setErr('Add an image: paste a https link or upload a file.');
    if (url && !/^https:\/\//i.test(url)) return setErr('The image link must start with https://');
    const input: CardInput = {
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
      if (!driverName.trim()) return setErr('Enter the driver name.');
      if (!Number.isInteger(p) || p < 0 || p > 1000) return setErr('Points must be a whole number from 0 to 1000.');
      input.driverName = driverName.trim();
      input.code = code.trim().toUpperCase().slice(0, 4) || undefined;
      input.number = number.trim() ? Number(number) : undefined;
      input.points = p;
    }
    setBusy(true);
    try {
      await saveCard(eventId, input);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the card.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-line p-4">
      <p className="font-medium">{card ? 'Edit' : 'Add'} {kind === 'vip' ? 'VIP pass design' : 'Play card'}</p>
      {kind === 'play' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={lbl}>
            Driver name
            <input className={`${inputCls} mt-1`} value={driverName} onChange={(e) => setDriverName(e.target.value)} maxLength={60} required />
          </label>
          <label className={lbl}>
            Points on the card
            <input className={`${inputCls} ${num} mt-1`} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} required />
          </label>
          <label className={lbl}>
            Timing code (e.g. LEC)
            <input className={`${inputCls} mt-1 uppercase`} value={code} onChange={(e) => setCode(e.target.value)} maxLength={4} />
          </label>
          <label className={lbl}>
            Car number
            <input className={`${inputCls} ${num} mt-1`} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
        </div>
      ) : (
        <label className={lbl}>
          Label (optional)
          <input className={`${inputCls} mt-1`} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} />
        </label>
      )}
      <label className={lbl}>
        Image link (https, e.g. your Cloudflare R2 / CDN URL) - preferred
        <input className={`${inputCls} mt-1`} value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://cdn.example.com/card-8f3k2.webp" />
      </label>
      <label className={lbl}>
        ...or upload a file (compressed and stored with the event)
        <input type="file" accept="image/*" className="mt-1 block text-sm" disabled={busy} onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      <div className="flex items-end gap-4">
        <Preview card={{ image: imageUrl.trim() ? undefined : image, imageUrl: imageUrl.trim() || undefined }} />
        {dims.w && dims.h && <p className={`${num} text-xs text-muted`}>{dims.w} x {dims.h}px</p>}
      </div>
      {err && <p role="alert" className="text-sm text-accent">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save'}</Button>
        <Button variant="ghost" onClick={onDone} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}

/** Host: card designs for one booking event (R45) - print size, the VIP pass design and one Play card
 * per driver with its points. Designs differ per race, so the host sets all of this before each event. */
export default function CardsAdmin({ event, onBack }: { event: BookingEvent; onBack: () => void }) {
  const [cards, setCards] = useState<CardDoc[] | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [editing, setEditing] = useState<{ kind: CardKind; card?: CardDoc } | null>(null);
  const [w, setW] = useState(event.cardSpec?.widthMm != null ? String(event.cardSpec.widthMm) : '');
  const [h, setH] = useState(event.cardSpec?.heightMm != null ? String(event.cardSpec.heightMm) : '');
  const [note, setNote] = useState(event.cardSpec?.note ?? '');
  const [specMsg, setSpecMsg] = useState('');
  const [delErr, setDelErr] = useState('');

  useEffect(() => watchCards(event.id, setCards, (e) => setLoadErr(e.message)), [event.id]);

  const vip = cards?.find((c) => c.kind === 'vip');
  const plays = (cards ?? []).filter((c) => c.kind === 'play');
  const nextOrder = (cards ?? []).reduce((m, c) => Math.max(m, c.order), 0) + 1;

  async function saveSpec(ev: React.FormEvent) {
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
    } catch (e) {
      setSpecMsg(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  async function remove(c: CardDoc) {
    if (!window.confirm(`Delete the ${c.driverName ?? c.title ?? 'card'} design? Guests who already drew it keep their copy.`)) return;
    setDelErr('');
    try {
      await deleteCard(event.id, c.id);
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : 'Could not delete.');
    }
  }

  return (
    <div className="py-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack} aria-label="Back to events">
          <ArrowLeft size={20} weight="regular" aria-hidden="true" />
          Back
        </Button>
        <div className="min-w-0">
          <h2 className="truncate text-lg font-medium">Cards - {event.title}</h2>
          <p className="text-sm text-muted">VIP pass and Play cards for this event. Upload every design before the event.</p>
        </div>
      </div>

      <form onSubmit={saveSpec} className="mt-6 grid gap-3 rounded-lg border border-line p-4 sm:grid-cols-[8rem_8rem_1fr_auto] sm:items-end">
        <label className={lbl}>
          Width (mm)
          <input className={`${inputCls} ${num} mt-1`} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
        </label>
        <label className={lbl}>
          Height (mm)
          <input className={`${inputCls} ${num} mt-1`} inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />
        </label>
        <label className={lbl}>
          Print note
          <input className={`${inputCls} mt-1`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. matte, rounded corners" />
        </label>
        <Button type="submit" variant="secondary">Save size</Button>
        {specMsg && <p role="status" className="text-sm text-muted sm:col-span-4">{specMsg}</p>}
      </form>

      {loadErr && <p role="alert" className="mt-4 text-sm text-accent">{loadErr}</p>}
      {cards === null && !loadErr && <RowsSkeleton />}

      {cards !== null && (
        <>
          <h3 className="mt-8 font-medium">VIP pass design</h3>
          {editing?.kind === 'vip' ? (
            <div className="mt-3"><CardForm eventId={event.id} kind="vip" card={vip} nextOrder={0} onDone={() => setEditing(null)} /></div>
          ) : (
            <div className="mt-3 flex items-center gap-4">
              {vip ? <Preview card={vip} /> : <p className="text-sm text-muted">No VIP pass design yet.</p>}
              <Button variant="secondary" onClick={() => setEditing({ kind: 'vip', card: vip })}>{vip ? 'Replace' : 'Add VIP design'}</Button>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <h3 className="font-medium">Play cards <span className={`${num} text-muted`}>({plays.length})</span></h3>
            {!editing && <Button variant="secondary" onClick={() => setEditing({ kind: 'play' })}>Add Play card</Button>}
          </div>
          {editing?.kind === 'play' && (
            <div className="mt-3">
              <CardForm key={editing.card?.id ?? 'new'} eventId={event.id} kind="play" card={editing.card} nextOrder={nextOrder} onDone={() => setEditing(null)} />
            </div>
          )}
          {delErr && <p role="alert" className="mt-3 text-sm text-accent">{delErr}</p>}
          {plays.length === 0 && !editing ? (
            <p className="mt-3 text-sm text-muted">No Play cards yet. Add one per driver in the deck, with the points printed on it.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {plays.map((c) => (
                <li key={c.id} className="flex items-center gap-3 rounded-lg border border-line p-3">
                  <Preview card={c} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.driverName}</p>
                    <p className={`${num} text-sm text-muted`}>
                      {c.code ?? ''}{c.number != null ? ` #${c.number}` : ''} - {c.points} pts
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button variant="secondary" className="min-h-11 px-3" onClick={() => setEditing({ kind: 'play', card: c })}>Edit</Button>
                    <Button variant="ghost" className="min-h-11 px-3" onClick={() => void remove(c)} aria-label={`Delete ${c.driverName}`}>
                      <Trash size={18} weight="regular" aria-hidden="true" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
