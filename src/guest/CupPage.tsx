import { useEffect, useState } from 'react';
import {
  fmtRoundDate,
  getResult,
  pickSeason,
  watchDrivers,
  watchPublishedSeasons,
  watchRounds,
  watchStandings,
  type CupDriver,
  type CupResult,
  type CupRound,
  type CupSeason,
  type Standings,
} from '../lib/cup';
import { usePageMeta } from '../lib/pageMeta';
import { Eyebrow, H3, PageTitle, Reveal, Shell } from './parts';
import { Stagger, StaggerItem, StartLightsLoader, Ticker } from '../components/motion';

const num = 'font-mono tabular-nums';

/** Public /cup: the current published Karter Cup season. Reads only published data (firestore.rules)
 * and one precomputed standings document (PRD s24.6). Ships no seed data: until a host publishes a
 * season it shows an honest empty state (R26). */
export default function CupPage() {
  const [seasons, setSeasons] = useState<CupSeason[] | null>(null);
  const [failed, setFailed] = useState(false);
  const season = seasons ? pickSeason(seasons) : null;

  usePageMeta({
    title: season ? `${season.name} standings` : 'Karter Cup',
    description: season
      ? `Standings, rounds and results for ${season.name} of the Karter Cup.`
      : 'Standings, rounds and results for the Karter Cup season, once the host publishes it.',
  });

  useEffect(() => watchPublishedSeasons(setSeasons, () => setFailed(true)), []);

  return (
    <Shell>
      <Reveal>
        <Eyebrow>Karter Cup</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>{season ? season.name : 'The Karter Cup season'}</h1>
        {season && (
          <p className="mt-2 font-mono text-sm text-muted">
            {season.year} / {season.status}
          </p>
        )}
      </Reveal>
      {failed ? (
        <p role="alert" className="mt-8 max-w-[60ch] text-muted">
          The standings could not be loaded right now. Check your connection and reload.
        </p>
      ) : !seasons ? (
        <p role="status" className="mt-8 flex items-center gap-3 text-muted">
          <StartLightsLoader label="Loading the season" />
          Loading the season.
        </p>
      ) : !season ? (
        <p className="mt-8 max-w-[60ch] text-muted md:text-lg">
          The Karter Cup season will appear here once the host publishes it. Standings, rounds and results
          are added after each round.
        </p>
      ) : (
        <SeasonView key={season.id} season={season} />
      )}
    </Shell>
  );
}

function SeasonView({ season }: { season: CupSeason }) {
  const [standings, setStandings] = useState<Standings | null | undefined>(undefined);
  const [drivers, setDrivers] = useState<CupDriver[]>([]);
  const [rounds, setRounds] = useState<CupRound[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const err = () => setFailed(true);
    const offs = [
      watchStandings(season.id, setStandings, err),
      watchDrivers(season.id, setDrivers, err),
      watchRounds(season.id, true, (r) => setRounds([...r].sort((a, b) => a.order - b.order || a.date.localeCompare(b.date))), err),
    ];
    return () => offs.forEach((o) => o());
  }, [season.id]);

  if (failed) {
    return (
      <p role="alert" className="mt-8 max-w-[60ch] text-muted">
        This season could not be loaded right now. Reload to try again.
      </p>
    );
  }

  return (
    <div className="mt-8 grid gap-12">
      <section aria-labelledby="cup-standings">
        <h2 id="cup-standings" className={H3}>Driver standings</h2>
        {standings === undefined ? (
          <p role="status" className="mt-3 text-muted">Loading standings.</p>
        ) : !standings || standings.drivers.length === 0 ? (
          <p className="mt-3 max-w-[60ch] text-muted">
            No standings yet. They appear after the first completed round is published.
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[20rem] border-collapse text-left">
                <caption className="sr-only">
                  Driver standings after {standings.roundsCounted} round{standings.roundsCounted === 1 ? '' : 's'}
                </caption>
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-widest text-muted">
                    <th scope="col" className="w-10 py-2 pr-2 font-mono font-normal">Pos</th>
                    <th scope="col" className="py-2 pr-2 font-mono font-normal">Driver</th>
                    <th scope="col" className="py-2 pl-2 text-right font-mono font-normal">Pts</th>
                    <th scope="col" className="py-2 pl-2 text-right font-mono font-normal">Wins</th>
                    <th scope="col" className="py-2 pl-2 text-right font-mono font-normal">Pod</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.drivers.map((r, i) => (
                    <tr key={r.driverId} className="border-b border-line">
                      <td className={`py-3 pr-2 text-muted ${num}`}>{i + 1}</td>
                      <td className="py-3 pr-2">
                        <span className="block font-medium text-ink">{r.name}</span>
                        {r.team && <span className="block text-sm text-muted">{r.team}</span>}
                      </td>
                      <td className={`py-3 pl-2 text-right text-[1.25rem] font-semibold text-gold ${num}`}>
                        <Ticker value={r.points} />
                      </td>
                      <td className={`py-3 pl-2 text-right text-muted ${num}`}>{r.wins}</td>
                      <td className={`py-3 pl-2 text-right text-muted ${num}`}>{r.podiums}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted">
              After {standings.roundsCounted} round{standings.roundsCounted === 1 ? '' : 's'}. Ties are split by
              wins, then podiums, then best finish.
            </p>
            {standings.teams.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold">Team standings</h3>
                <Stagger as="ol" className="mt-3 divide-y divide-line border-y border-line">
                  {standings.teams.map((t, i) => (
                    <StaggerItem as="li" kind="slide" key={t.team} className="flex items-center gap-4 py-3">
                      <span className={`w-8 text-muted ${num}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium">{t.team}</span>
                      <span className={`font-semibold ${num}`}>
                        <Ticker value={t.points} />
                      </span>
                    </StaggerItem>
                  ))}
                </Stagger>
              </div>
            )}
          </>
        )}
      </section>

      <section aria-labelledby="cup-rounds">
        <h2 id="cup-rounds" className={H3}>Rounds</h2>
        {!rounds ? (
          <p role="status" className="mt-3 text-muted">Loading rounds.</p>
        ) : rounds.length === 0 ? (
          <p className="mt-3 max-w-[60ch] text-muted">No rounds have been published for this season yet.</p>
        ) : (
          <Stagger as="ul" className="mt-4 divide-y divide-line border-y border-line">
            {rounds.map((r) => (
              <RoundItem key={r.id} seasonId={season.id} round={r} drivers={drivers} />
            ))}
          </Stagger>
        )}
      </section>
    </div>
  );
}

function RoundItem({ seasonId, round, drivers }: { seasonId: string; round: CupRound; drivers: CupDriver[] }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<CupResult | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const done = round.status === 'completed';

  useEffect(() => {
    if (!open || result !== undefined) return;
    let live = true;
    getResult(seasonId, round.id).then(
      (r) => live && setResult(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [open, result, seasonId, round.id]);

  const name = (id: string) => drivers.find((d) => d.id === id)?.name ?? 'Former driver';
  const panelId = `round-${round.id}`;

  return (
    <StaggerItem as="li" kind="slide" className="py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`w-8 text-muted ${num}`}>{round.order}</span>
        <span className="min-w-[12rem] flex-1">
          <span className="block font-medium">{round.name}</span>
          <span className="block text-sm text-muted">
            <span className={num}>{fmtRoundDate(round.date)}</span>
            {round.venue ? ` / ${round.venue}` : ''}
          </span>
        </span>
        <span className="rounded-full border border-line px-3 py-0.5 font-mono text-xs uppercase tracking-widest text-muted">
          {done ? 'Completed' : 'Scheduled'}
        </span>
        {done && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((o) => !o)}
            className="kerb-link kerb-link--rest inline-flex min-h-11 items-center text-sm text-ink hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {open ? 'Hide results' : 'Show results'}
          </button>
        )}
      </div>
      {open && (
        <div id={panelId} className="mt-3 pl-0 sm:pl-12">
          {failed ? (
            <p role="alert" className="text-sm text-muted">Results could not be loaded.</p>
          ) : result === undefined ? (
            <p role="status" className="text-sm text-muted">Loading results.</p>
          ) : result === null ? (
            <p className="text-sm text-muted">Results for this round have not been published yet.</p>
          ) : (
            <>
              <ol className="grid gap-1">
                {result.order.map((id, i) => (
                  <li key={id} className="flex gap-4 text-sm">
                    <span className={`w-8 text-muted ${num}`}>{i + 1}</span>
                    <span>
                      {name(id)}
                      {result.fastestLap === id && <span className="ml-2 text-muted">(fastest lap)</span>}
                    </span>
                  </li>
                ))}
              </ol>
              {result.dnf && result.dnf.length > 0 && (
                <p className="mt-2 text-sm text-muted">Did not finish: {result.dnf.map(name).join(', ')}.</p>
              )}
            </>
          )}
        </div>
      )}
    </StaggerItem>
  );
}
