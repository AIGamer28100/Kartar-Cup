import { useState } from 'react';
import { clearNetCaches } from '../../mockNet';
import { fetchConstructorStandings, fetchDriverStandings, fetchSchedule } from '../../../lib/f1api';
import { fetchDrivers, fetchLineupForRace, findSessionKey } from '../../../lib/openf1';
import { clearMemoryCache, fetchForecast, fetchLaps, fetchResults, fetchSessionWeather, fetchSessions, fetchTyreUse, sessionPhase } from '../../../lib/raceData';
import type { PanelProps } from '../MockLab';
import { Case, Grid, Json, LabButton } from '../parts';

/* Every F1 data call, run on demand against whatever the toolbar's Mock Net scenario is. Nothing fires on mount. */

const RACE = { id: '2026-r16-malaysia', country: 'Malaysia', locality: 'Kuala Lumpur', raceDate: '2026-10-04' };
const RACE_KEY = 11731;
const MEETING = 1308;

type Outcome = { state: 'idle' } | { state: 'running' } | { state: 'ok'; value: unknown; ms: number } | { state: 'error'; message: string; ms: number };

function RunCase({ title, call, wide = false }: { title: string; call: () => Promise<unknown>; wide?: boolean }) {
  const [out, setOut] = useState<Outcome>({ state: 'idle' });
  const run = async () => {
    const t = Date.now();
    setOut({ state: 'running' });
    try {
      const value = await call();
      setOut({ state: 'ok', value: value instanceof Map ? [...value.entries()] : value, ms: Date.now() - t });
    } catch (e) {
      setOut({ state: 'error', message: e instanceof Error ? `${e.name}: ${e.message}` : String(e), ms: Date.now() - t });
    }
  };
  return (
    <Case title={title} wide={wide}>
      <div className="flex items-center gap-2">
        <LabButton onClick={() => void run()} pressed={out.state === 'running'}>
          Run
        </LabButton>
        <span className="font-mono text-[0.65rem] text-muted">
          {out.state === 'idle' && 'not run'}
          {out.state === 'running' && 'running'}
          {out.state === 'ok' && `resolved in ${out.ms}ms`}
          {out.state === 'error' && `rejected in ${out.ms}ms`}
        </span>
      </div>
      {out.state === 'error' && <p className="mt-2 font-mono text-xs text-accent-text">{out.message}</p>}
      {out.state === 'ok' && <Json label="result" value={Array.isArray(out.value) && out.value.length > 6 ? { length: out.value.length, first: out.value.slice(0, 3) } : out.value} />}
    </Case>
  );
}

export default function OpenF1Panel({ nowMs }: PanelProps) {
  const [cleared, setCleared] = useState(0);
  return (
    <Grid>
      <Case title="Caches" note="raceData keeps an in-memory cache (10 min sessions, 24 h the rest) plus a sessionStorage copy. The toolbar's Clear caches does both; this button is the same. Clear before re-running after a scenario change." wide>
        <LabButton
          onClick={() => {
            clearNetCaches();
            clearMemoryCache();
            setCleared((n) => n + 1);
          }}
        >
          Clear caches
        </LabButton>
        <span className="ml-2 font-mono text-[0.65rem] text-muted">cleared {cleared}x</span>
      </Case>

      <RunCase
        title={`fetchSessions(${MEETING}) + sessionPhase at the lab clock`}
        call={async () => (await fetchSessions(MEETING)).map((s) => ({ key: s.key, name: s.name, start: s.startUtc.slice(0, 16), phase: sessionPhase(s, nowMs) }))}
      />
      <RunCase title={`fetchResults(${RACE_KEY})`} call={() => fetchResults(RACE_KEY)} />
      <RunCase title={`fetchLaps(${RACE_KEY})`} call={() => fetchLaps(RACE_KEY)} />
      <RunCase title={`fetchTyreUse(${RACE_KEY})`} call={() => fetchTyreUse(RACE_KEY)} />
      <RunCase title={`fetchSessionWeather(${RACE_KEY})`} call={() => fetchSessionWeather(RACE_KEY)} />
      <RunCase title="fetchForecast (Marina Bay)" call={() => fetchForecast(1.2914, 103.864, '2026-10-09', '2026-10-11')} />
      <RunCase title="fetchSchedule(2026)" call={() => fetchSchedule(2026)} />
      <RunCase title="fetchDriverStandings(2026)" call={() => fetchDriverStandings(2026)} />
      <RunCase title="fetchConstructorStandings(2026)" call={() => fetchConstructorStandings(2026)} />
      <RunCase title="findSessionKey(2026, Malaysia)" call={() => findSessionKey(2026, RACE)} />
      <RunCase title={`fetchDrivers(${RACE_KEY})`} call={() => fetchDrivers(RACE_KEY)} />
      <RunCase title="fetchLineupForRace(2026, Malaysia)" call={() => fetchLineupForRace(2026, RACE)} />
    </Grid>
  );
}
