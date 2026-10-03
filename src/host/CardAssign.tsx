import { useEffect, useState } from 'react';
import { DiceFive } from '@phosphor-icons/react';
import Button from '../components/Button';
import { assignCards, cardImageSrc, drawRandomPlayCard, nextPassNumber, watchCards } from '../lib/cards';
import type { Booking, BookingEvent, CardDoc, PlayCardSnapshot } from '../lib/types';
import { inputCls } from './settings/ui';

/** Door-side card handout (R45): the host gives the guest their VIP pass number and records the Play
 * card they drew at random from the physical deck (pick it, or press Draw for a digital random draw).
 * The card is copied onto the guest's own booking so only they see it (R15), and its points are added
 * to their quiz score (R46). Safe to repeat: the pass number is kept, the Play card can be corrected. */
export default function CardAssign({ booking, event }: { booking: Booking; event: BookingEvent | null }) {
  const [cards, setCards] = useState<CardDoc[]>([]);
  const [pass, setPass] = useState<number | undefined>(booking.passNumber);
  const [play, setPlay] = useState<PlayCardSnapshot | null>(booking.playCard ?? null);
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!event) return;
    return watchCards(event.id, setCards, () => setCards([]));
  }, [event]);

  const plays = cards.filter((c) => c.kind === 'play');
  const next = event ? nextPassNumber(event) : undefined;

  async function assign() {
    setBusy(true);
    setErr('');
    try {
      const chosen = plays.find((c) => c.id === pick) ?? null;
      const r = await assignCards(booking.id, chosen);
      setPass(r.passNumber);
      setPlay(r.playCard);
      setPick('');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not assign the cards.');
    } finally {
      setBusy(false);
    }
  }

  function draw() {
    const c = drawRandomPlayCard(plays);
    if (c) setPick(c.id);
  }

  const src = cardImageSrc(play);

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <p className="text-sm font-medium">VIP pass and Play card</p>
      {pass != null && (
        <p className="mt-2 flex items-center gap-3">
          {src && <img src={src} alt="" className="h-16 w-auto rounded border border-line object-contain" />}
          <span className="font-mono tabular-nums">
            Pass #{pass}
            {play && (
              <span className="block text-sm text-muted">
                {play.code ?? play.driverName} - {play.points} pts
              </span>
            )}
          </span>
        </p>
      )}
      {plays.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            className={`${inputCls} min-w-0 flex-1`}
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            aria-label="Play card the guest drew"
          >
            <option value="">{play ? 'Keep current Play card' : 'Choose the Play card drawn'}</option>
            {plays.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ?? c.driverName}{c.number != null ? ` #${c.number}` : ''} - {c.points} pts
              </option>
            ))}
          </select>
          <Button variant="secondary" className="min-h-11 px-3" onClick={draw} aria-label="Draw a random Play card">
            <DiceFive size={20} weight="regular" aria-hidden="true" />
            Draw
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">No Play cards set up for this event yet (Host &gt; Bookings &gt; Cards).</p>
      )}
      <Button className="mt-3 min-h-11" disabled={busy || (pass != null && !pick)} onClick={() => void assign()}>
        {busy ? 'Saving...' : pass == null ? `Assign pass${next ? ` #${next}` : ''}${pick ? ' + card' : ''}` : 'Update Play card'}
      </Button>
      {err && <p role="alert" className="mt-2 text-sm text-accent">{err}</p>}
    </div>
  );
}
