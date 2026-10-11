import { useMemo, useState } from 'react';
import ResultsHub from '../../../guest/results/ResultsHub';
import type { RaceSession } from '../../../lib/raceData';
import sessionsDone from '../../fixtures/net/sessions.done.json';
import sessionsNext from '../../fixtures/net/sessions.next.json';
import type { PanelProps } from '../MockLab';
import { Case, Grid, Pick } from '../parts';

/* The Results hub fetches session_result / laps / drivers itself: turn Mock Net on in the toolbar, then use its scenario
   (Completed, No data yet, Rate limited, Offline) to reach the loading, empty and error states. */

type Weekend = 'done' | 'next';
const WEEKENDS: { id: Weekend; label: string }[] = [
  { id: 'done', label: 'Malaysia (completed)' },
  { id: 'next', label: 'Singapore (upcoming)' },
];

type Raw = { session_key: number; session_name: string; session_type: string; date_start: string; date_end: string; gmt_offset?: string; is_cancelled?: boolean };
const toSessions = (rows: Raw[]): RaceSession[] =>
  rows
    .map((r) => ({ key: r.session_key, name: r.session_name, type: r.session_type, startUtc: r.date_start, endUtc: r.date_end, gmtOffset: r.gmt_offset ?? '00:00:00', cancelled: Boolean(r.is_cancelled) }))
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));

export default function ResultsPanel(_props: PanelProps) {
  const [weekend, setWeekend] = useState<Weekend>('done');
  const sessions = useMemo(() => toSessions((weekend === 'done' ? sessionsDone : sessionsNext) as Raw[]), [weekend]);
  return (
    <Grid>
      <Case title="Results hub" note="Session tabs, driver and team tables, fastest lap marker, podium. Needs Mock Net on; the toolbar scenario drives loading, empty and error. Session phase uses the real clock, not the lab offset." wide>
        <Pick label="Weekend" value={weekend} options={WEEKENDS} onChange={setWeekend} />
        <div className="mt-4">
          {/* keyed: the hub keeps per-session loads, a different weekend must start clean */}
          <ResultsHub key={weekend} sessions={sessions} />
        </div>
      </Case>
    </Grid>
  );
}
