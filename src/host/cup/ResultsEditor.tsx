import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, X } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { getResult, saveResult, type CupDriver, type CupRound } from '../../lib/cup';
import { Field, iconBtn, inputCls, linkBtn } from '../settings/ui';

/** Enter one round's finishing order. Tap a driver to add them as the next finisher (or as a DNF),
 * then reorder with up/down. Works on a phone: every control is 44px. Saving also refreshes standings. */
export default function ResultsEditor({
  seasonId,
  round,
  drivers,
  onClose,
}: {
  seasonId: string;
  round: CupRound;
  drivers: CupDriver[];
  onClose: () => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [dnf, setDnf] = useState<string[]>([]);
  const [fastest, setFastest] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let live = true;
    getResult(seasonId, round.id).then(
      (r) => {
        if (!live) return;
        setOrder(r?.order ?? []);
        setDnf(r?.dnf ?? []);
        setFastest(r?.fastestLap ?? '');
        setState('ready');
      },
      () => live && setState('failed'),
    );
    return () => {
      live = false;
    };
  }, [seasonId, round.id]);

  const name = (id: string) => drivers.find((d) => d.id === id)?.name ?? 'Removed driver';
  const known = new Set(drivers.map((d) => d.id));
  const placed = new Set([...order, ...dnf]);
  const free = drivers.filter((d) => !placed.has(d.id));

  const move = (i: number, by: number) =>
    setOrder((o) => {
      const j = i + by;
      if (j < 0 || j >= o.length) return o;
      const n = [...o];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      await saveResult(seasonId, round, {
        order: order.filter((id) => known.has(id)),
        dnf: dnf.filter((id) => known.has(id)),
        ...(fastest && known.has(fastest) ? { fastestLap: fastest } : {}),
      });
      setMsg({ ok: true, text: 'Results saved and standings updated.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Save failed. Try again.' });
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <p className="py-6 text-muted" role="status">Loading results.</p>;
  if (state === 'failed')
    return (
      <p className="py-6 text-accent" role="alert">
        Could not load this round&rsquo;s results. Close and try again.
      </p>
    );

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-lg font-semibold">Results: {round.name}</h4>
        <button type="button" className={iconBtn} onClick={onClose} aria-label="Close results editor">
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      {drivers.length === 0 && <p className="mt-3 text-muted">Add drivers to this season first.</p>}

      <h5 className="mt-5 text-sm font-medium text-muted">Finishing order</h5>
      {order.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nobody placed yet. Tap a driver below to add them as 1st.</p>
      ) : (
        <ol className="mt-2 divide-y divide-line border-y border-line">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-2 py-2">
              <span className="w-8 shrink-0 font-mono tabular-nums text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{name(id)}</span>
              <button type="button" className={iconBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${name(id)} up`}>
                <ArrowUp size={18} aria-hidden="true" />
              </button>
              <button type="button" className={iconBtn} onClick={() => move(i, 1)} disabled={i === order.length - 1} aria-label={`Move ${name(id)} down`}>
                <ArrowDown size={18} aria-hidden="true" />
              </button>
              <button type="button" className={iconBtn} onClick={() => setOrder((o) => o.filter((x) => x !== id))} aria-label={`Remove ${name(id)} from the order`}>
                <X size={18} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      <h5 className="mt-5 text-sm font-medium text-muted">Did not finish</h5>
      {dnf.length === 0 ? (
        <p className="mt-2 text-sm text-muted">None.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {dnf.map((id) => (
            <li key={id}>
              <button type="button" className={linkBtn} onClick={() => setDnf((d) => d.filter((x) => x !== id))}>
                {name(id)} <span className="text-muted">(DNF, tap to clear)</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h5 className="mt-5 text-sm font-medium text-muted">Unplaced drivers</h5>
      {free.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Everyone is placed.</p>
      ) : (
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {free.map((d) => (
            <li key={d.id} className="flex items-center gap-2">
              <button type="button" className={`${linkBtn} flex-1 justify-start`} onClick={() => setOrder((o) => [...o, d.id])}>
                {d.name}
              </button>
              <button type="button" className={linkBtn} onClick={() => setDnf((x) => [...x, d.id])} aria-label={`Mark ${d.name} as did not finish`}>
                DNF
              </button>
            </li>
          ))}
        </ul>
      )}

      <Field id="fl" label="Fastest lap (optional)" className="mt-5 max-w-xs">
        <select id="fl" className={inputCls} value={fastest} onChange={(e) => setFastest(e.target.value)}>
          <option value="">None</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </Field>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={busy || drivers.length === 0}>{busy ? 'Saving' : 'Save results'}</Button>
        {msg && (
          <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm text-muted' : 'text-sm text-accent'}>
            {msg.text}
          </p>
        )}
      </div>
      <p className="mt-3 text-sm text-muted">
        Results count toward standings only when the round is completed and published.
      </p>
    </div>
  );
}
