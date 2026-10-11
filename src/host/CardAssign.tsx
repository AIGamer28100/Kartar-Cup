import { useState } from 'react';
import Button from '../components/Button';
import { assignCards, nextPassNumber } from '../lib/cards';
import type { Booking, BookingEvent } from '../lib/types';

/** Door-side VIP pass handout (R45): the host gives the guest their pass number. Safe to repeat: the pass
 * number is kept. Play cards are no longer recorded here: the guest reports theirs in the quiz (R71). */
export default function CardAssign({ booking, event }: { booking: Booking; event: BookingEvent | null }) {
  const [pass, setPass] = useState<number | undefined>(booking.passNumber);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const next = event ? nextPassNumber(event) : undefined;

  async function assign() {
    setBusy(true);
    setErr('');
    try {
      const r = await assignCards(booking.id, null);
      setPass(r.passNumber);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not assign the pass.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <p className="text-sm font-medium">VIP pass</p>
      {pass != null ? (
        <p className="mt-2 font-mono tabular-nums">Pass #{pass}</p>
      ) : (
        <Button className="mt-3 min-h-11" disabled={busy} onClick={() => void assign()}>
          {busy ? 'Saving...' : `Assign pass${next ? ` #${next}` : ''}`}
        </Button>
      )}
      {err && <p role="alert" className="mt-2 text-sm text-accent-text">{err}</p>}
    </div>
  );
}
