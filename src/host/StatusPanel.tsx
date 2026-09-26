import { useEffect, useState } from 'react';
import { Flag, LockSimple, LockSimpleOpen } from '@phosphor-icons/react';
import Button from '../components/Button';
import StatusDot from '../components/StatusDot';
import { LIGHTS_OUT_UTC } from '../config/event';
import { initEvent, setEventStatus, setLightsOut } from '../lib/db';
import type { EventDoc } from '../lib/types';

function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function StatusPanel({ event, count }: { event: EventDoc | null; count: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lights, setLights] = useState('');

  const lightsMs = event?.lightsOutUtc.toMillis();
  useEffect(() => {
    if (lightsMs !== undefined) setLights(toLocalInput(new Date(lightsMs)));
  }, [lightsMs]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The pit wall did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const focus =
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

  return (
    <section aria-label="Race control" className="border-b border-line py-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted">Grid entries</p>
          <p className="font-mono text-7xl tabular-nums leading-none md:text-8xl" aria-live="polite">
            {count}
          </p>
        </div>
        {event ? (
          <div className="flex flex-col items-start gap-3 md:items-end">
            <p className="flex items-center gap-3 text-2xl">
              <StatusDot status={event.status} />
              <span className="uppercase tracking-widest">{event.status}</span>
            </p>
            {event.status === 'open' ? (
              <Button disabled={busy} onClick={() => run(() => setEventStatus('locked'))}>
                <LockSimple size={20} weight="regular" /> Lock the pit lane
              </Button>
            ) : (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => run(() => setEventStatus('open'))}
              >
                <LockSimpleOpen size={20} weight="regular" /> Reopen entries
              </Button>
            )}
          </div>
        ) : (
          <Button disabled={busy} onClick={() => run(() => initEvent(LIGHTS_OUT_UTC))}>
            <Flag size={20} weight="regular" /> Initialize event
          </Button>
        )}
      </div>

      {event ? (
        <form
          className="mt-6 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!lights) return;
            void run(() => setLightsOut(new Date(lights).toISOString()));
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-muted">
            Lights out (your local time)
            <input
              type="datetime-local"
              value={lights}
              onChange={(e) => setLights(e.target.value)}
              className={`min-h-12 rounded-lg border border-line bg-raised px-3 font-mono text-base text-ink ${focus}`}
            />
          </label>
          <Button type="submit" variant="secondary" disabled={busy || !lights}>
            Move lights out
          </Button>
        </form>
      ) : (
        <p className="mt-4 text-muted">No event on the grid yet. Initialize it to open entries.</p>
      )}
      {err && (
        <p role="alert" className="mt-4 text-accent">
          {err}
        </p>
      )}
    </section>
  );
}
