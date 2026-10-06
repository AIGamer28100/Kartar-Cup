import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash } from '@phosphor-icons/react';
import Button from '../../components/Button';
import { RowsSkeleton } from '../../components/Skeleton';
import {
  DEFAULT_POINTS_TABLE,
  createSeason,
  deleteDriver,
  deleteRound,
  fmtRoundDate,
  parsePointsTable,
  recomputeStandings,
  saveDriver,
  saveRound,
  saveSeason,
  validatePointsTable,
  watchAllSeasons,
  watchDrivers,
  watchRounds,
  watchStandings,
  type CupDriver,
  type CupRound,
  type CupSeason,
  type SeasonStatus,
} from '../../lib/cup';
import { Field, Section, iconBtn, inputCls } from '../settings/ui';
import ResultsEditor from './ResultsEditor';

type Msg = { ok: boolean; text: string } | null;

function Banner({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? 'status' : 'alert'} className={`text-sm ${msg.ok ? 'text-muted' : 'text-accent-text'}`}>
      {msg.text}
    </p>
  );
}

/** Runs an async host action with busy + message handling; nothing is swallowed. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function run(fn: () => Promise<unknown>, ok: string): Promise<boolean> {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, msg, run, clear: () => setMsg(null) };
}

export { SeasonEditor, ResultsEditor, RoundForm };

export default function CupAdmin() {
  const [seasons, setSeasons] = useState<CupSeason[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const act = useAction();

  useEffect(
    () =>
      watchAllSeasons(
        (s) => setSeasons([...s].sort((a, b) => b.year - a.year || a.name.localeCompare(b.name))),
        () => setFailed(true),
      ),
    [],
  );

  if (failed) {
    return (
      <p className="py-8 text-accent-text" role="alert">
        Could not load Cup seasons. Check your connection and permissions, then reload.
      </p>
    );
  }
  if (!seasons) return <RowsSkeleton />;

  const open = seasons.find((s) => s.id === openId);
  if (open) return <SeasonEditor key={open.id} season={open} onBack={() => setOpenId(null)} />;

  const y = Number(year);
  const canCreate = name.trim().length > 0 && Number.isInteger(y) && y >= 2000 && y <= 2100;

  return (
    <div className="pb-24">
      <h2 className="mt-6 text-2xl font-semibold md:text-3xl">Karter Cup</h2>
      <p className="mt-1 max-w-2xl text-muted">
        Seasons, drivers, rounds and results for the public /cup page. Nothing is public until you publish a
        season and its rounds.
      </p>

      <Section title="Seasons">
        {seasons.length === 0 ? (
          <p className="text-muted">No seasons yet. Create the first one below.</p>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {seasons.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(s.id)}
                  className="flex min-h-14 w-full items-center justify-between gap-3 py-2 text-left hover:text-accent-text"
                >
                  <span className="min-w-0 truncate font-medium">{s.name}</span>
                  <span className="shrink-0 font-mono text-sm text-muted">
                    {s.year} / {s.status} / {s.published ? 'published' : 'draft'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-6 grid max-w-2xl gap-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canCreate) return;
            void act
              .run(
                () =>
                  createSeason({
                    name: name.trim(),
                    year: y,
                    status: 'upcoming',
                    pointsTable: DEFAULT_POINTS_TABLE,
                    fastestLapBonus: 0,
                    published: false,
                  }),
                'Season created as a draft.',
              )
              .then((ok) => ok && setName(''));
          }}
        >
          <Field id="ns-name" label="New season name">
            <input id="ns-name" className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="ns-year" label="Year">
            <input id="ns-year" className={`${inputCls} font-mono`} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Button type="submit" disabled={!canCreate || act.busy}>
            <Plus size={18} aria-hidden="true" /> Create
          </Button>
        </form>
        <div className="mt-3"><Banner msg={act.msg} /></div>
      </Section>
    </div>
  );
}

function SeasonEditor({ season, onBack }: { season: CupSeason; onBack: () => void }) {
  const [name, setName] = useState(season.name);
  const [year, setYear] = useState(String(season.year));
  const [status, setStatus] = useState<SeasonStatus>(season.status);
  const [table, setTable] = useState(season.pointsTable.join(', '));
  const [bonus, setBonus] = useState(String(season.fastestLapBonus ?? 0));
  const [published, setPublished] = useState(season.published);
  const [touched, setTouched] = useState(false);
  const act = useAction();

  const parsed = parsePointsTable(table);
  const tableErr = validatePointsTable(parsed);
  const bonusN = Number(bonus);
  const bonusErr = Number.isInteger(bonusN) && bonusN >= 0 && bonusN <= 10 ? '' : 'Whole number from 0 to 10.';
  const yearN = Number(year);
  const yearErr = Number.isInteger(yearN) && yearN >= 2000 && yearN <= 2100 ? '' : 'Year 2000 to 2100.';
  const nameErr = name.trim() ? '' : 'Name is required.';
  const invalid = !!(tableErr || bonusErr || yearErr || nameErr);

  function save() {
    setTouched(true);
    if (invalid) return;
    void act.run(
      () => saveSeason({ id: season.id, name: name.trim(), year: yearN, status, pointsTable: parsed, fastestLapBonus: bonusN, published }),
      published ? 'Saved. This season is public.' : 'Saved as a draft (not public).',
    );
  }

  return (
    <div className="pb-24">
      <button type="button" onClick={onBack} className="mt-4 inline-flex min-h-11 items-center gap-2 text-muted hover:text-ink">
        <ArrowLeft size={20} aria-hidden="true" /> Seasons
      </button>
      <h2 className="mt-2 text-2xl font-semibold md:text-3xl">{season.name}</h2>

      <Section title="Season settings" intro="The points table is per season: position 1 first. Editing it recomputes standings.">
        <div className="grid gap-5 md:grid-cols-2">
          <Field id="s-name" label="Name" error={touched ? nameErr : undefined}>
            <input id="s-name" className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id="s-year" label="Year" error={touched ? yearErr : undefined}>
            <input id="s-year" className={`${inputCls} font-mono`} inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </Field>
          <Field id="s-status" label="Status">
            <select id="s-status" className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as SeasonStatus)}>
              <option value="upcoming">Upcoming</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
          <Field id="s-bonus" label="Fastest-lap bonus points (0 = off)" error={touched ? bonusErr : undefined}>
            <input id="s-bonus" className={`${inputCls} font-mono`} inputMode="numeric" value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </Field>
          <Field
            id="s-table"
            label="Points table (1st, 2nd, 3rd, ...)"
            hint="Separate with commas or spaces, up to 20 positions. Positions beyond the list score 0."
            error={touched ? tableErr : undefined}
            className="md:col-span-2"
          >
            <input id="s-table" className={`${inputCls} font-mono`} value={table} onChange={(e) => setTable(e.target.value)} />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
            Published (visible on the public /cup page)
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={act.busy}>{act.busy ? 'Saving' : 'Save season'}</Button>
          <Banner msg={act.msg} />
        </div>
      </Section>

      <DriversPanel seasonId={season.id} />
      <RoundsPanel seasonId={season.id} />
      <StandingsPanel seasonId={season.id} />
    </div>
  );
}

function useList<T>(sub: (cb: (v: T[]) => void, err: () => void) => () => void): { list: T[] | null; failed: boolean } {
  const [list, setList] = useState<T[] | null>(null);
  const [failed, setFailed] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => sub(setList, () => setFailed(true)), []);
  return { list, failed };
}

const LoadFail = ({ what }: { what: string }) => (
  <p role="alert" className="text-accent-text">Could not load {what}.</p>
);

function DriversPanel({ seasonId }: { seasonId: string }) {
  const { list, failed } = useList<CupDriver>((cb, err) => watchDrivers(seasonId, cb, err));
  const [adding, setAdding] = useState(false);
  const act = useAction();

  const drivers = list ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : null;
  return (
    <Section title="Drivers" intro="Removing a driver drops them from standings; use Inactive to keep their results.">
      {failed ? (
        <LoadFail what="drivers" />
      ) : !drivers ? (
        <p className="text-muted" role="status">Loading drivers.</p>
      ) : (
        <>
          {drivers.length === 0 && <p className="mb-4 text-muted">No drivers yet.</p>}
          <ul className="grid gap-4">
            {drivers.map((d) => (
              <DriverRow key={d.id} d={d} seasonId={seasonId} />
            ))}
          </ul>
          {adding ? (
            <DriverForm
              seasonId={seasonId}
              initial={{ id: '', name: '', active: true }}
              onDone={() => setAdding(false)}
            />
          ) : (
            <Button variant="secondary" className="mt-4" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden="true" /> Add driver
            </Button>
          )}
          <div className="mt-3"><Banner msg={act.msg} /></div>
        </>
      )}
    </Section>
  );
}

function DriverRow({ d, seasonId }: { d: CupDriver; seasonId: string }) {
  const [edit, setEdit] = useState(false);
  const act = useAction();
  if (edit) return <li><DriverForm seasonId={seasonId} initial={d} onDone={() => setEdit(false)} /></li>;
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {d.number !== undefined && <span className="mr-2 font-mono tabular-nums text-muted">#{d.number}</span>}
          {d.name}
        </span>
        <span className="block text-sm text-muted">{[d.team, d.active ? 'Active' : 'Inactive'].filter(Boolean).join(' / ')}</span>
      </span>
      <Button variant="secondary" className="min-h-11" onClick={() => setEdit(true)}>Edit</Button>
      <button
        type="button"
        className={iconBtn}
        aria-label={`Remove ${d.name}`}
        disabled={act.busy}
        onClick={() => {
          if (window.confirm(`Remove ${d.name}? They will drop out of the standings. Past results keep their slot.`)) {
            void act.run(() => deleteDriver(seasonId, d), 'Driver removed.');
          }
        }}
      >
        <Trash size={18} aria-hidden="true" />
      </button>
      {act.msg && <div className="w-full"><Banner msg={act.msg} /></div>}
    </li>
  );
}

function DriverForm({ seasonId, initial, onDone }: { seasonId: string; initial: CupDriver; onDone: () => void }) {
  const [name, setName] = useState(initial.name);
  const [number, setNumber] = useState(initial.number === undefined ? '' : String(initial.number));
  const [team, setTeam] = useState(initial.team ?? '');
  const [active, setActive] = useState(initial.active);
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const numN = Number(number);
  const numErr = number === '' || (Number.isInteger(numN) && numN >= 0 && numN <= 999) ? '' : 'Whole number 0 to 999.';
  const nameErr = name.trim() ? '' : 'Name is required.';
  const id = `drv-${initial.id || 'new'}`;

  function save() {
    setTouched(true);
    if (nameErr || numErr) return;
    void act
      .run(
        () =>
          saveDriver(seasonId, {
            id: initial.id,
            name: name.trim(),
            active,
            ...(number !== '' ? { number: numN } : {}),
            ...(team.trim() ? { team: team.trim() } : {}),
          }),
        'Driver saved.',
      )
      .then((ok) => ok && onDone());
  }

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-n`} label="Name" error={touched ? nameErr : undefined}>
          <input id={`${id}-n`} className={inputCls} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id={`${id}-no`} label="Number (optional)" error={touched ? numErr : undefined}>
          <input id={`${id}-no`} className={`${inputCls} font-mono`} inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} />
        </Field>
        <Field id={`${id}-t`} label="Team (optional)">
          <input id={`${id}-t`} className={inputCls} value={team} maxLength={60} onChange={(e) => setTeam(e.target.value)} />
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={act.busy}>{act.busy ? 'Saving' : 'Save driver'}</Button>
        <Button variant="ghost" onClick={onDone} disabled={act.busy}>Cancel</Button>
        <Banner msg={act.msg} />
      </div>
    </div>
  );
}

function RoundsPanel({ seasonId }: { seasonId: string }) {
  const { list, failed } = useList<CupRound>((cb, err) => watchRounds(seasonId, false, cb, err));
  const { list: drivers } = useList<CupDriver>((cb, err) => watchDrivers(seasonId, cb, err));
  const [editing, setEditing] = useState<string | null>(null); // round id, or '' for new
  const [resultsFor, setResultsFor] = useState<string | null>(null);
  const act = useAction();

  const rounds = list ? [...list].sort((a, b) => a.order - b.order || a.date.localeCompare(b.date)) : null;
  const nextOrder = rounds && rounds.length ? Math.max(...rounds.map((r) => r.order)) + 1 : 1;
  const forResults = rounds?.find((r) => r.id === resultsFor);

  return (
    <Section title="Rounds" intro="A round counts toward standings only when it is completed, published and has results.">
      {failed ? (
        <LoadFail what="rounds" />
      ) : !rounds ? (
        <p className="text-muted" role="status">Loading rounds.</p>
      ) : (
        <>
          {rounds.length === 0 && <p className="mb-4 text-muted">No rounds yet.</p>}
          <ul className="grid gap-4">
            {rounds.map((r) =>
              editing === r.id ? (
                <li key={r.id}><RoundForm seasonId={seasonId} initial={r} onDone={() => setEditing(null)} /></li>
              ) : (
                <li key={r.id} className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <span className="mr-2 font-mono tabular-nums text-muted">{r.order}</span>
                      {r.name}
                    </span>
                    <span className="block text-sm text-muted">
                      {[fmtRoundDate(r.date), r.venue, r.status, r.published ? 'published' : 'draft'].filter(Boolean).join(' / ')}
                    </span>
                  </span>
                  <Button variant="secondary" className="min-h-11" onClick={() => setResultsFor(r.id)}>Results</Button>
                  <Button variant="secondary" className="min-h-11" onClick={() => setEditing(r.id)}>Edit</Button>
                  <button
                    type="button"
                    className={iconBtn}
                    aria-label={`Delete ${r.name}`}
                    disabled={act.busy}
                    onClick={() => {
                      if (window.confirm(`Delete ${r.name} and its results? This cannot be undone.`)) {
                        if (resultsFor === r.id) setResultsFor(null);
                        void act.run(() => deleteRound(seasonId, r), 'Round deleted.');
                      }
                    }}
                  >
                    <Trash size={18} aria-hidden="true" />
                  </button>
                </li>
              ),
            )}
          </ul>
          {forResults && drivers && (
            <ResultsEditor key={forResults.id} seasonId={seasonId} round={forResults} drivers={drivers} onClose={() => setResultsFor(null)} />
          )}
          {editing === '' ? (
            <RoundForm
              seasonId={seasonId}
              initial={{ id: '', name: '', date: '', order: nextOrder, status: 'scheduled', published: false }}
              onDone={() => setEditing(null)}
            />
          ) : (
            <Button variant="secondary" className="mt-4" onClick={() => setEditing('')}>
              <Plus size={18} aria-hidden="true" /> Add round
            </Button>
          )}
          <div className="mt-3"><Banner msg={act.msg} /></div>
        </>
      )}
    </Section>
  );
}

function RoundForm({ seasonId, initial, onDone }: { seasonId: string; initial: CupRound; onDone: () => void }) {
  const [name, setName] = useState(initial.name);
  const [date, setDate] = useState(initial.date);
  const [venue, setVenue] = useState(initial.venue ?? '');
  const [order, setOrder] = useState(String(initial.order));
  const [status, setStatus] = useState(initial.status);
  const [published, setPublished] = useState(initial.published);
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const orderN = Number(order);
  const errs = {
    name: name.trim() ? '' : 'Name is required.',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? '' : 'Pick a date.',
    order: Number.isInteger(orderN) && orderN >= 0 && orderN <= 1000 ? '' : 'Whole number 0 to 1000.',
  };
  const id = `rnd-${initial.id || 'new'}`;

  function save() {
    setTouched(true);
    if (errs.name || errs.date || errs.order) return;
    void act
      .run(
        () =>
          saveRound(seasonId, {
            id: initial.id,
            name: name.trim(),
            date,
            order: orderN,
            status,
            published,
            ...(venue.trim() ? { venue: venue.trim() } : {}),
          }),
        'Round saved.',
      )
      .then((ok) => ok && onDone());
  }

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-n`} label="Name" error={touched ? errs.name : undefined}>
          <input id={`${id}-n`} className={inputCls} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id={`${id}-d`} label="Date" error={touched ? errs.date : undefined}>
          <input id={`${id}-d`} type="date" className={`${inputCls} font-mono`} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field id={`${id}-v`} label="Venue (optional)">
          <input id={`${id}-v`} className={inputCls} value={venue} maxLength={80} onChange={(e) => setVenue(e.target.value)} />
        </Field>
        <Field id={`${id}-o`} label="Round number" error={touched ? errs.order : undefined}>
          <input id={`${id}-o`} className={`${inputCls} font-mono`} inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value)} />
        </Field>
        <Field id={`${id}-s`} label="Status">
          <select id={`${id}-s`} className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as CupRound['status'])}>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
          </select>
        </Field>
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} /> Published
        </label>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={act.busy}>{act.busy ? 'Saving' : 'Save round'}</Button>
        <Button variant="ghost" onClick={onDone} disabled={act.busy}>Cancel</Button>
        <Banner msg={act.msg} />
      </div>
    </div>
  );
}

function StandingsPanel({ seasonId }: { seasonId: string }) {
  const [info, setInfo] = useState<{ roundsCounted: number; updatedAt?: { toDate: () => Date } } | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const act = useAction();
  useEffect(() => watchStandings(seasonId, (s) => setInfo(s), () => setFailed(true)), [seasonId]);

  const when = info?.updatedAt?.toDate().toLocaleString();
  return (
    <Section title="Standings" intro="Precomputed here and stored for the public page. They refresh automatically on every save above.">
      {failed ? (
        <LoadFail what="standings" />
      ) : (
        <p className="text-muted" role="status">
          {info === undefined
            ? 'Loading.'
            : info === null
              ? 'Not computed yet.'
              : `${info.roundsCounted} round${info.roundsCounted === 1 ? '' : 's'} counted${when ? `, updated ${when}` : ''}.`}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={act.busy} onClick={() => void act.run(() => recomputeStandings(seasonId), 'Standings recomputed.')}>
          {act.busy ? 'Recomputing' : 'Recompute standings'}
        </Button>
        <Banner msg={act.msg} />
      </div>
    </Section>
  );
}
