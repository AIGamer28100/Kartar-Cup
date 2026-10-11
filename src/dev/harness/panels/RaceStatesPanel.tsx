import { useState } from 'react';
import { RaceStateBackdrop, RaceStateDisplay, getRaceStateInfo, type PodiumDriver, type RaceState } from '../../../components/RaceStateDisplay';
import TrackMap from '../../../components/TrackMap';
import { parsePodium } from '../../../lib/podium';
import driversRace from '../../fixtures/net/drivers.race.json';
import resultRace from '../../fixtures/net/session_result.race.json';
import type { PanelProps } from '../MockLab';
import { Case, Grid, LabButton, Pick } from '../parts';

/* Every RaceState on the real display + backdrop, driven by the lab clock. Race states are picked by hand. */

const MIN = 60_000;
interface Item {
  id: string;
  label: string;
  state: (nowMs: number) => RaceState;
  /** Race start relative to the lab clock. */
  startOffsetMs: number;
}
const ITEMS: Item[] = [
  { id: 'scheduled', label: 'Scheduled (in 3 days)', state: () => 'scheduled', startOffsetMs: 3 * 24 * 60 * MIN },
  { id: 'upcoming', label: 'Upcoming (in 2 hours)', state: () => 'upcoming', startOffsetMs: 120 * MIN },
  { id: 'lights-out-countdown', label: 'Lights-out countdown', state: () => 'lights-out-countdown', startOffsetMs: 4 * MIN },
  { id: 'lights-out-sequence', label: 'Start lights', state: () => 'lights-out-sequence', startOffsetMs: 12_000 },
  { id: 'in-progress', label: 'In progress', state: () => 'in-progress', startOffsetMs: -38 * MIN },
  { id: 'yellow-flag', label: 'Yellow flag', state: () => 'yellow-flag', startOffsetMs: -20 * MIN },
  { id: 'yellow-flag-sector', label: 'Yellow flag, sector 2', state: () => ({ type: 'yellow-flag-sector', sector: 2 }), startOffsetMs: -20 * MIN },
  { id: 'red-flag', label: 'Red flag', state: () => 'red-flag', startOffsetMs: -25 * MIN },
  { id: 'red-resume-standing', label: 'Red flag, standing restart in 6 min', state: (n) => ({ type: 'red-flag', resumeAtMs: n + 6 * MIN, resumeProcedure: 'standing' }), startOffsetMs: -25 * MIN },
  { id: 'red-resume-rolling', label: 'Red flag, rolling restart in 6 min', state: (n) => ({ type: 'red-flag', resumeAtMs: n + 6 * MIN, resumeProcedure: 'rolling' }), startOffsetMs: -25 * MIN },
  { id: 'safety-car', label: 'Safety car', state: () => 'safety-car', startOffsetMs: -30 * MIN },
  { id: 'safety-car-rolling', label: 'Safety car, rolling restart', state: () => ({ type: 'safety-car', isRollingRestart: true }), startOffsetMs: -30 * MIN },
  { id: 'safety-car-ending', label: 'Safety car ending', state: () => 'safety-car-ending', startOffsetMs: -30 * MIN },
  { id: 'virtual-safety-car', label: 'Virtual safety car', state: () => 'virtual-safety-car', startOffsetMs: -30 * MIN },
  { id: 'last-lap', label: 'Last lap', state: () => 'last-lap', startOffsetMs: -100 * MIN },
  { id: 'chequered-flag', label: 'Chequered flag', state: () => 'chequered-flag', startOffsetMs: -110 * MIN },
  { id: 'completed', label: 'Completed (podium)', state: () => 'completed', startOffsetMs: -4 * 60 * MIN },
  { id: 'cancelled-by-host', label: 'Cancelled by host', state: () => 'cancelled-by-host', startOffsetMs: -MIN },
];

const PODIUM: PodiumDriver[] | undefined = parsePodium(resultRace, driversRace) ?? undefined;

export default function RaceStatesPanel({ nowMs }: PanelProps) {
  const [id, setId] = useState(ITEMS[0].id);
  const item = ITEMS.find((i) => i.id === id) ?? ITEMS[0];
  const [raceStartMs, setRaceStartMs] = useState(() => nowMs + item.startOffsetMs);
  const [animate, setAnimate] = useState(true);
  const state = item.state(nowMs);

  const pick = (next: string) => {
    const n = ITEMS.find((i) => i.id === next) ?? ITEMS[0];
    setId(n.id);
    setRaceStartMs(nowMs + n.startOffsetMs);
  };

  return (
    <Grid>
      <Case title="RaceStateDisplay" note={`${getRaceStateInfo(state).label}: ${getRaceStateInfo(state).description}`} wide>
        <Pick label="Race state" value={id} options={ITEMS} onChange={pick} />
        <p className="mt-2 font-mono text-[0.65rem] text-muted">
          start {new Date(raceStartMs).toISOString().slice(11, 19)}Z · lab clock {new Date(nowMs).toISOString().slice(11, 19)}Z
        </p>
        <div className="relative isolate mt-3 overflow-hidden rounded-md border border-line p-6">
          <RaceStateDisplay key={id} state={state} raceStartMs={raceStartMs} drivers={PODIUM} showStateBackground={false} />
        </div>
      </Case>

      <Case title="Backdrop" note="RaceStateBackdrop alone, behind a plain block.">
        <div className="relative isolate h-40 overflow-hidden rounded-md border border-line">
          <RaceStateBackdrop state={state} />
        </div>
      </Case>

      <Case title="Track map" note="Sepang outline; the draw-on animation replays when switched on.">
        <LabButton pressed={animate} onClick={() => setAnimate((v) => !v)}>
          animate
        </LabButton>
        <div className="mt-3 max-w-sm">
          <TrackMap raceId="2026-r16-malaysia" animate={animate} state={state} title="Sepang" />
        </div>
      </Case>
    </Grid>
  );
}
