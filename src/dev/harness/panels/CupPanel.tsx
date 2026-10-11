import { useMemo, useState } from 'react';
import ChampionshipSection from '../../../guest/Championship';
import { DEFAULT_POINTS_TABLE, computeStandings, fmtRoundDate, pickSeason, validatePointsTable, type CupDriver, type CupSeason, type RoundWithResult } from '../../../lib/cupScoring';
import type { PanelProps } from '../MockLab';
import { Case, Grid, LabButton, Pick } from '../parts';

/* CupPage and CupAdmin read Firestore, so they are not mounted. Standings maths, season pick and the real F1 championship section are. */

const DRIVERS: CupDriver[] = [
  { id: 'ana', name: 'Ananya Pillai', number: 7, team: 'Red', active: true },
  { id: 'rohan', name: 'Rohan Das', number: 12, team: 'Red', active: true },
  { id: 'meera', name: 'Meera Iyer', number: 33, team: 'Blue', active: true },
  { id: 'vikram', name: 'Vikram Rao', number: 44, team: 'Blue', active: true },
  { id: 'dev', name: 'Dev Malhotra', number: 5, active: false },
];
const ROUNDS: RoundWithResult[] = [
  { id: 'r1', name: 'Round 1', date: '2026-08-02', venue: 'Chennai', order: 1, status: 'completed', published: true, result: { order: ['ana', 'meera', 'rohan', 'vikram'], fastestLap: 'meera' } },
  { id: 'r2', name: 'Round 2', date: '2026-09-06', venue: 'Chennai', order: 2, status: 'completed', published: true, result: { order: ['meera', 'ana', 'vikram'], dnf: ['rohan'], fastestLap: 'ana' } },
  { id: 'r3', name: 'Round 3 (unpublished)', date: '2026-10-04', order: 3, status: 'completed', published: false, result: { order: ['rohan', 'ana'] } },
  { id: 'r4', name: 'Round 4', date: '2026-11-08', order: 4, status: 'scheduled', published: true, result: null },
];
const SEASONS: CupSeason[] = [
  { id: 's25', name: 'Cup 2025', year: 2025, status: 'completed', pointsTable: DEFAULT_POINTS_TABLE, fastestLapBonus: 0, published: true },
  { id: 's26', name: 'Cup 2026', year: 2026, status: 'active', pointsTable: DEFAULT_POINTS_TABLE, fastestLapBonus: 1, published: true },
  { id: 's27', name: 'Cup 2027', year: 2027, status: 'upcoming', pointsTable: DEFAULT_POINTS_TABLE, fastestLapBonus: 0, published: true },
];

export default function CupPanel(_props: PanelProps) {
  const [bonus, setBonus] = useState(1);
  const standings = useMemo(() => computeStandings(DRIVERS, ROUNDS, DEFAULT_POINTS_TABLE, bonus), [bonus]);
  const [year, setYear] = useState(2026);
  return (
    <Grid>
      <Case title="Driver standings" note="computeStandings over fixture rounds: the unpublished and scheduled rounds do not count, a DNF scores nothing, ties break on wins, podiums, best finish, then name." wide>
        <Pick label="Fastest lap bonus" value={`${bonus}` as '0' | '1'} options={[{ id: '0', label: 'Bonus off' }, { id: '1', label: '+1 fastest lap' }]} onChange={(v) => setBonus(Number(v))} />
        <table className="mt-3 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-line text-left font-mono text-[0.65rem] uppercase tracking-widest text-muted">
              <th className="py-1 pr-2 font-normal">#</th><th className="py-1 pr-2 font-normal">driver</th><th className="py-1 pr-2 font-normal">pts</th><th className="py-1 pr-2 font-normal">wins</th><th className="py-1 pr-2 font-normal">podiums</th><th className="py-1 pr-2 font-normal">rounds</th><th className="py-1 font-normal">best</th>
            </tr>
          </thead>
          <tbody>
            {standings.drivers.map((r, i) => (
              <tr key={r.driverId} className="border-b border-line/60">
                <td className="py-1 pr-2 font-mono text-muted">{i + 1}</td>
                <td className="py-1 pr-2 text-ink">{r.name}</td>
                <td className="py-1 pr-2 font-mono text-ink">{r.points}</td>
                <td className="py-1 pr-2 font-mono text-muted">{r.wins}</td>
                <td className="py-1 pr-2 font-mono text-muted">{r.podiums}</td>
                <td className="py-1 pr-2 font-mono text-muted">{r.rounds}</td>
                <td className="py-1 font-mono text-muted">{r.bestFinish ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Rounds counted: {standings.roundsCounted} · Teams: {standings.teams.map((t) => `${t.team} ${t.points}`).join(', ') || 'none'}</p>
      </Case>
      <Case title="Rounds and points table" note="Date formatting and points-table validation.">
        <ul className="text-xs text-muted">
          {ROUNDS.map((r) => (
            <li key={r.id}>{r.name} · {fmtRoundDate(r.date)} · {r.status}{r.published ? '' : ' · hidden'}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Default table valid: <span className="font-mono text-ink">{validatePointsTable(DEFAULT_POINTS_TABLE) || 'ok'}</span></p>
        <p className="mt-1 text-xs text-muted">Negative entry: <span className="font-mono text-ink">{validatePointsTable([25, -1]) || 'ok'}</span></p>
        <p className="mt-1 text-xs text-muted">Empty table: <span className="font-mono text-ink">{validatePointsTable([]) || 'ok'}</span></p>
      </Case>
      <Case title="Season pick" note="pickSeason: the active season first, then the newest year.">
        <p className="text-xs text-muted">All three: <span className="text-ink">{pickSeason(SEASONS)?.name}</span> · without active: <span className="text-ink">{pickSeason(SEASONS.filter((s) => s.status !== 'active'))?.name}</span> · none: <span className="text-ink">{String(pickSeason([]))}</span></p>
      </Case>
      <Case title="F1 championship section" note="The real ChampionshipSection over the captured Jolpica payloads. Needs Mock Net on; otherwise it hits the live feed." wide>
        <div className="flex gap-2">
          {[2025, 2026].map((y) => (
            <LabButton key={y} pressed={year === y} onClick={() => setYear(y)}>{y}</LabButton>
          ))}
        </div>
        <div className="mt-4"><ChampionshipSection key={year} season={year} /></div>
      </Case>
    </Grid>
  );
}
