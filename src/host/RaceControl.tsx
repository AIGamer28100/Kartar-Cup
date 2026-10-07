import { useState } from 'react';
import { LockSimple, LockSimpleOpen } from '@phosphor-icons/react';
import Button from '../components/Button';
import StatusDot from '../components/StatusDot';
import { setOverride } from '../lib/db';
import { useEventStatus } from '../lib/eventStatus';
import type { EventConfig } from '../lib/types';

const LABEL = { scheduled: 'Scheduled', open: 'Open', closed: 'Closed', scored: 'Scored' } as const;

/** Top of the host console: live entry count plus a quick open/close for the live event.
 * (Times, extensions and the full set of controls live under Settings, Live controls.) */
export default function RaceControl({ config, count }: { config: EventConfig | null; count: number }) {
  const status = useEventStatus(config);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(override: 'open' | 'closed') {
    if (!config) return;
    setBusy(true);
    setErr(null);
    try {
      await setOverride(config.id, override);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The pit wall did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Race control" className="border-b border-line py-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-sm uppercase tracking-widest text-muted">Grid entries</p>
          <p className="font-mono text-5xl tabular-nums leading-none md:text-6xl" aria-live="polite">
            {count}
          </p>
        </div>
        {config && status ? (
          <div className="flex flex-col items-start gap-3 md:items-end">
            <p className="flex items-center gap-3 text-2xl">
              <StatusDot status={status === 'open' ? 'open' : status === 'scored' ? 'scored' : 'locked'} />
              <span className="uppercase tracking-widest">{LABEL[status]}</span>
            </p>
            {status === 'open' ? (
              <Button disabled={busy} onClick={() => void run('closed')}>
                <LockSimple size={20} weight="regular" aria-hidden="true" /> Lock the pit lane
              </Button>
            ) : status !== 'scored' ? (
              <Button variant="secondary" disabled={busy} onClick={() => void run('open')}>
                <LockSimpleOpen size={20} weight="regular" aria-hidden="true" /> Reopen entries
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted">No live event yet. Set one live under Settings.</p>
        )}
      </div>
      {err && (
        <p role="alert" className="mt-4 text-accent-text">
          {err}
        </p>
      )}
    </section>
  );
}
