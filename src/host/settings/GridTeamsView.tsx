import { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';
import Button from '../../components/Button';
import type { RaceInfo } from '../../config/calendar';
import { fetchLiveGrid, type GridStatus } from '../../config/event';
import { Section } from './ui';
import type { FormState } from './model';

type Patch = (fn: (f: FormState) => Partial<FormState>) => void;

/** R30/R37: Grid and Teams are sourced live from OpenF1, never hand-edited. This banner always
 * shows where the currently-displayed data came from, so the host never mistakes a stale/
 * provisional grid for the real entry list. */
export function GridStatusBanner({ status }: { status: GridStatus }) {
  if (status.kind === 'fetched') {
    const ago = Math.round((Date.now() - status.fetchedAtMs) / 60_000);
    return (
      <p className="text-sm text-muted">
        Live from OpenF1 {ago <= 0 ? 'just now' : `${ago} min ago`}.
      </p>
    );
  }
  if (status.kind === 'no-data') {
    return (
      <p className="text-sm text-muted">
        OpenF1 has no entry list for this race yet — showing the provisional pre-season grid.
        Refresh closer to the race weekend.
      </p>
    );
  }
  if (status.kind === 'error') {
    return <p className="text-sm text-accent">Couldn&rsquo;t reach OpenF1 ({status.reason}) — showing the provisional grid.</p>;
  }
  return <p className="text-sm text-muted">As last saved. Refresh to check OpenF1 for updates.</p>;
}

/** Shared refresh control + the once-per-view auto-refresh for a just-loaded saved event
 * (gridStatus 'saved' means this session hasn't actually checked OpenF1 yet). */
export function useGridRefresh(form: FormState | null, patch: Patch, race: RaceInfo | null) {
  const [busy, setBusy] = useState(false);
  const autoFired = useRef(false);

  const refresh = async () => {
    if (!race || busy) return;
    setBusy(true);
    try {
      const { teams, drivers, gridStatus } = await fetchLiveGrid(race);
      patch(() => ({ teams, drivers, gridStatus }));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (autoFired.current) return;
    if (!form || !race) return;
    if (form.gridStatus.kind !== 'saved') return;
    autoFired.current = true;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.id, race?.id]);

  return { busy, refresh };
}

export function RefreshGridButton({ busy, onRefresh, disabled }: { busy: boolean; onRefresh: () => void; disabled: boolean }) {
  return (
    <Button variant="secondary" disabled={disabled || busy} onClick={onRefresh}>
      <ArrowsClockwise size={20} weight="regular" className={busy ? 'animate-spin' : undefined} />
      {busy ? 'Refreshing...' : 'Refresh from OpenF1'}
    </Button>
  );
}

export function GridView({ form }: { form: FormState }) {
  return (
    <Section title="Starting grid" intro="Pulled live from OpenF1, so it can't be edited by hand.">
      <GridStatusBanner status={form.gridStatus} />
      <div
        aria-hidden="true"
        className="mt-4 hidden grid-cols-[3rem_1fr_1fr] gap-x-4 border-t border-line pb-2 pt-3 text-sm font-medium text-muted md:grid"
      >
        <span>Pos</span>
        <span>Driver</span>
        <span>Team</span>
      </div>
      <ol className="mt-4 divide-y divide-line border-y border-line md:mt-0">
        {form.drivers.map((d, i) => {
          const team = form.teams.find((t) => t.id === d.teamId);
          return (
            <li key={d.id} className="grid grid-cols-[2.5rem_1fr] gap-x-3 py-3 md:grid-cols-[3rem_1fr_1fr] md:items-center md:gap-x-4">
              <span className="font-mono text-muted" aria-label={`Grid position ${i + 1}`}>
                P{i + 1}
              </span>
              <span className="text-ink">{d.label}</span>
              <span className="col-span-2 text-sm text-muted md:col-span-1 md:text-[1rem]">{team?.label ?? '—'}</span>
            </li>
          );
        })}
      </ol>
      {form.drivers.length === 0 && <p className="py-6 text-sm text-muted">No drivers to show yet.</p>}
    </Section>
  );
}

export function TeamsView({ form }: { form: FormState }) {
  return (
    <Section title="Teams" intro="Pulled live from OpenF1, so it can't be edited by hand.">
      <GridStatusBanner status={form.gridStatus} />
      <ul className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
        {form.teams.map((t) => (
          <li key={t.id} className="py-1 text-ink">
            {t.label}
          </li>
        ))}
      </ul>
      {form.teams.length === 0 && <p className="py-6 text-sm text-muted">No teams to show yet.</p>}
    </Section>
  );
}
