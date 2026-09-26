import { useEffect, useState } from 'react';
import { Lightning, LockSimple, LockSimpleOpen, Plus, ArrowCounterClockwise } from '@phosphor-icons/react';
import Button from '../../components/Button';
import Skeleton from '../../components/Skeleton';
import { extendCloses, getActiveEventId, setOverride, watchActiveEventId, watchEventConfig } from '../../lib/db';
import { useEventStatus } from '../../lib/eventStatus';
import type { EventConfig } from '../../lib/types';
import { Section, TimeTriple } from './ui';

export default function LiveControls() {
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);
  const [cfg, setCfg] = useState<EventConfig | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const status = useEventStatus(cfg);

  useEffect(() => watchActiveEventId(setActiveId, (e) => setErr(e.message)), []);
  useEffect(() => {
    if (!activeId) {
      setCfg(activeId === null ? null : undefined);
      return;
    }
    return watchEventConfig(activeId, setCfg, (e) => setErr(e.message));
  }, [activeId]);

  async function run(fn: (id: string) => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      const id = activeId ?? (await getActiveEventId());
      if (!id) throw new Error('No live event yet. Set one as live first.');
      await fn(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The pit wall did not answer. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const label = { scheduled: 'Scheduled', open: 'Open', closed: 'Closed', scored: 'Scored' } as const;

  return (
    <Section title="Live controls" intro="These act on the live event immediately, no save needed.">
      {cfg === undefined && activeId !== null && <Skeleton className="h-24" />}
      {(activeId === null || cfg === null) && <p className="text-muted">No live event yet. Save an event and set it live below.</p>}
      {cfg && (
        <>
          <div className="grid gap-6 md:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-muted">Live event</p>
              <p className="mt-1 text-lg">{cfg.name}</p>
              <p className="mt-1 text-sm text-muted">
                Status <span data-testid="live-status" className="font-mono text-ink">{status ? label[status] : '--'}</span>
                {cfg.override !== 'none' && (
                  <span className="font-mono text-ink"> (override: {cfg.override})</span>
                )}
              </p>
            </div>
            <TimeTriple label="Quiz opens" ms={cfg.opensAt.toMillis()} testId="live-opens" />
            <TimeTriple label="Quiz closes" ms={cfg.closesAt.toMillis()} testId="live-closes" />
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="secondary" disabled={busy} onClick={() => run((id) => setOverride(id, 'open'))}>
              <LockSimpleOpen size={20} weight="regular" /> Open now
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => run((id) => setOverride(id, 'closed'))}>
              <LockSimple size={20} weight="regular" /> Close now
            </Button>
            {[5, 10, 15].map((m) => (
              <Button key={m} variant="secondary" disabled={busy} onClick={() => run((id) => extendCloses(id, m))}>
                <Plus size={20} weight="regular" /> Extend closing +{m} min
              </Button>
            ))}
            <Button variant="ghost" disabled={busy} onClick={() => run((id) => setOverride(id, 'none'))}>
              <ArrowCounterClockwise size={20} weight="regular" /> Clear override
            </Button>
          </div>
        </>
      )}
      {err && (
        <p role="alert" className="mt-4 text-accent">
          <Lightning size={16} weight="regular" className="mr-1 inline" />
          {err}
        </p>
      )}
    </Section>
  );
}
