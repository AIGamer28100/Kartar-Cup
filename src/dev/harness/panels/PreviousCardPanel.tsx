import { useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { PreviousRaceCard } from '../../../guest/PreviousRaceCard';
import { getRace } from '../../../config/calendar';
import { clearPodiumCache } from '../../../lib/podium';
import driversRace from '../../fixtures/net/drivers.race.json';
import resultRace from '../../fixtures/net/session_result.race.json';
import sessionsDone from '../../fixtures/net/sessions.done.json';
import type { PanelProps } from '../MockLab';
import { Case, Grid, Pick } from '../parts';

/* The Previous race card on Events, fed by a scoped OpenF1 shim so every state is reachable without Mock Net. */

type CardState = 'ok' | 'loading' | 'none' | 'error';
const STATES: { id: CardState; label: string; note: string }[] = [
  { id: 'ok', label: 'Podium', note: 'Captured Malaysia result: winner tile plus P2 and P3 rows.' },
  { id: 'loading', label: 'Loading', note: 'OpenF1 never answers: the shimmer placeholder.' },
  { id: 'none', label: 'No result', note: 'OpenF1 answers with empty arrays: "Results aren’t available right now."' },
  { id: 'error', label: 'Error', note: 'OpenF1 answers 500: lib/podium swallows it and the card shows the no-result state.' },
];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function shim(state: CardState, real: typeof fetch): typeof fetch {
  return (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!raw.startsWith('https://api.openf1.org/')) return real(input, init);
    if (state === 'loading') return new Promise<Response>(() => {});
    if (state === 'error') return Promise.resolve(json({ detail: 'lab: forced failure' }, 500));
    if (state === 'none') return Promise.resolve(json([]));
    const u = new URL(raw);
    if (u.pathname.endsWith('/sessions')) {
      const type = u.searchParams.get('session_type');
      return Promise.resolve(json(type ? sessionsDone.filter((s) => s.session_type === type) : sessionsDone));
    }
    if (u.pathname.endsWith('/session_result')) return Promise.resolve(json(resultRace));
    if (u.pathname.endsWith('/drivers')) return Promise.resolve(json(driversRace));
    return Promise.resolve(json([]));
  };
}

export default function PreviousCardPanel(_props: PanelProps) {
  const [state, setState] = useState<CardState>('ok');
  const race = getRace('2026-r16-malaysia');

  useEffect(() => {
    clearPodiumCache();
    const real = globalThis.fetch;
    const mine = shim(state, real);
    globalThis.fetch = mine;
    return () => {
      if (globalThis.fetch === mine) globalThis.fetch = real;
      clearPodiumCache();
    };
  }, [state]);

  if (!race) return <p className="text-xs text-accent-text">2026-r16-malaysia is not in the calendar.</p>;
  return (
    <Grid>
      <Case title="Previous race card" note={STATES.find((s) => s.id === state)?.note} wide>
        <Pick label="Podium state" value={state} options={STATES} onChange={setState} />
        <div className="mt-4 max-w-md">
          {/* keyed: the card fetches once per race object, so a state change must remount it */}
          <MemoryRouter key={state}>
            <PreviousRaceCard race={race} range="02-04 OCT 2026" circuit="Sepang International Circuit, Kuala Lumpur" />
          </MemoryRouter>
        </div>
      </Case>
    </Grid>
  );
}
