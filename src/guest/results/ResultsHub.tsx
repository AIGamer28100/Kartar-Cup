import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ActiveKerb, ActivePill, Stagger, StaggerItem, Ticker } from '../../components/motion';
import Skeleton from '../../components/Skeleton';
import { fetchLaps, fetchResults, teamStandings, type RaceSession, type ResultRow } from '../../lib/raceData';
import {
  defaultSessionKey,
  fastestLapOf,
  isPointsSession,
  sessionKind,
  sessionTabs,
  shortSessionLabel,
  splitName,
  statusText,
  timeOrGap,
  type SessionKind,
} from './resultsModel';

/* Results hub for the race detail page, laid out the way formula1.com presents a weekend's results:
 * session tabs, a classification table (POS, NO, DRIVER, TEAM, LAPS, TIME/GAP, PTS) and a
 * Drivers / Teams switch in the same table style. The latest completed session opens straight away. */

// Official F1 headshots are hot-linked from OpenF1's URLs (never downloaded or re-hosted). Flip to false
// to fall back to monograms everywhere if F1 ever restricts the images (see decisions.md).
const SHOW_HEADSHOTS = true;

const mono = 'font-mono tabular-nums';
const th = 'sticky top-0 z-10 bg-base px-2.5 py-3 text-left font-mono text-[0.6875rem] font-medium uppercase tracking-widest text-muted shadow-[inset_0_-1px_0_var(--color-line)] first:pl-3';
const td = 'px-2.5 py-2 align-middle first:pl-3';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ok'; rows: ResultRow[] };
type View = 'drivers' | 'teams';

/* ---------- roving tablist (arrow keys, Home/End, disabled tabs skipped) ---------- */

function useRovingTabs<K extends string | number>(keys: K[], enabled: (k: K) => boolean, select: (k: K) => void) {
  const refs = useRef(new Map<K, HTMLButtonElement | null>());
  const onKeyDown = (e: KeyboardEvent, current: K) => {
    const live = keys.filter(enabled);
    if (!live.length) return;
    const i = live.indexOf(current);
    let next: K | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = live[(i + 1) % live.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = live[(i - 1 + live.length) % live.length];
    else if (e.key === 'Home') next = live[0];
    else if (e.key === 'End') next = live[live.length - 1];
    if (next === undefined) return;
    e.preventDefault();
    select(next);
    refs.current.get(next)?.focus();
  };
  const ref = (k: K) => (el: HTMLButtonElement | null) => {
    refs.current.set(k, el);
  };
  return { onKeyDown, ref };
}

/* ---------- small pieces ---------- */

function Face({ row }: { row: Pick<ResultRow, 'headshotUrl' | 'code' | 'colour'> }) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      aria-hidden="true"
      className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-raised"
      style={{ borderColor: row.colour }}
    >
      {SHOW_HEADSHOTS && row.headshotUrl && !broken ? (
        <img src={row.headshotUrl} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover object-top" />
      ) : (
        <span className={`${mono} text-[0.625rem] font-semibold tracking-wider text-ink`}>{row.code.slice(0, 3)}</span>
      )}
    </span>
  );
}

function TeamMarker({ colour, tall = false }: { colour: string; tall?: boolean }) {
  return <span aria-hidden="true" className={`inline-block w-1 shrink-0 rounded-full ${tall ? 'h-7' : 'h-5'}`} style={{ background: colour }} />;
}

function FastestBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-sm border border-info/40 bg-info/10 px-1.5 py-px font-mono text-[0.625rem] uppercase tracking-wider text-info">
      Fastest lap
    </span>
  );
}

function Segmented<K extends string>({
  label,
  options,
  value,
  onChange,
  layoutId,
  idPrefix,
}: {
  label: string;
  options: { key: K; text: string }[];
  value: K;
  onChange: (k: K) => void;
  layoutId: string;
  idPrefix: string;
}) {
  const roving = useRovingTabs(
    options.map((o) => o.key),
    () => true,
    onChange,
  );
  return (
    <div role="tablist" aria-label={label} className="inline-flex rounded-lg border border-line p-1">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            ref={roving.ref(o.key)}
            id={`${idPrefix}-${o.key}`}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => roving.onKeyDown(e, o.key)}
            className={`relative isolate min-h-11 min-w-24 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              on ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {on && <ActivePill layoutId={layoutId} />}
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- tables ---------- */

function Scroller({ children, label }: { children: ReactNode; label: string }) {
  // Only the table scrolls sideways (never the page); the header row sticks while the body scrolls.
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="relative mt-4 max-h-[min(72vh,46rem)] overflow-auto overscroll-x-contain rounded-lg border border-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </div>
  );
}

function DriversTable({
  rows,
  kind,
  sessionName,
  fastestNumber,
  motionKey,
}: {
  rows: ResultRow[];
  kind: SessionKind;
  sessionName: string;
  fastestNumber: number | null;
  motionKey: string;
}) {
  const points = isPointsSession(sessionName);
  const leader = rows.find((r) => r.position === 1) ?? rows[0];
  const timeHead = kind === 'race' || kind === 'sprint' ? 'Time / Retired' : kind === 'qualifying' ? 'Best lap' : 'Time / Gap';
  return (
    <Scroller label={`${sessionName} classification`}>
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">{`${sessionName} classification`}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${th} w-12`}>
              <abbr title="Position" className="no-underline">Pos</abbr>
            </th>
            <th scope="col" className={`${th} w-12`}>
              <abbr title="Car number" className="no-underline">No</abbr>
            </th>
            <th scope="col" className={th}>Driver</th>
            <th scope="col" className={th}>Team</th>
            <th scope="col" className={`${th} text-right`}>Laps</th>
            <th scope="col" className={`${th} text-right`}>{timeHead}</th>
            {points && (
              <th scope="col" className={`${th} pr-3 text-right`}>
                <abbr title="Points" className="no-underline">Pts</abbr>
              </th>
            )}
          </tr>
        </thead>
        <Stagger key={motionKey} as="tbody" step={0.03} amount={0.05}>
          {rows.map((r) => {
            const status = statusText(r);
            const podium = r.position != null && r.position <= 3 && !status;
            const { first, last } = splitName(r.name);
            const fastest = fastestNumber === r.number;
            const cell = timeOrGap(r, leader, kind);
            return (
              <StaggerItem
                as="tr"
                kind="slide"
                key={r.number}
                className={`border-t border-line/70 ${podium ? 'bg-raised/60' : ''} transition-colors hover:bg-raised/80`}
              >
                <th scope="row" className={`${td} text-left font-normal`}>
                  <span className={`${mono} ${podium ? 'font-semibold text-ink' : 'text-muted'}`}>{status ?? r.position}</span>
                  {status && <span className="sr-only">{`, ${status === 'NC' ? 'not classified' : status}`}</span>}
                </th>
                <td className={`${td} ${mono} text-muted`}>{r.number}</td>
                <td className={td}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <TeamMarker colour={r.colour} />
                    <Face row={r} />
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                        {first && <span className="hidden text-muted sm:inline">{first}</span>}
                        <span className="font-semibold uppercase tracking-wide text-ink">{last}</span>
                        <span className={`${mono} text-xs text-muted`} aria-label={`code ${r.code}`}>
                          {r.code}
                        </span>
                      </span>
                      {fastest && (
                        <span className="mt-0.5 block">
                          <FastestBadge />
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className={`${td} whitespace-nowrap text-muted`}>{r.team}</td>
                <td className={`${td} ${mono} text-right text-muted`}>{r.laps ?? ''}</td>
                <td className={`${td} ${mono} whitespace-nowrap text-right ${status && status !== 'NC' ? 'text-accent-text' : 'text-ink'}`}>
                  {cell}
                </td>
                {points && (
                  <td className={`${td} ${mono} pr-3 text-right ${r.points > 0 ? 'font-semibold text-gold' : 'text-muted'}`}>{r.points > 0 ? r.points : 0}</td>
                )}
              </StaggerItem>
            );
          })}
        </Stagger>
      </table>
    </Scroller>
  );
}

function TeamsTable({ rows, sessionName, motionKey }: { rows: ResultRow[]; sessionName: string; motionKey: string }) {
  const teams = useMemo(() => teamStandings(rows), [rows]);
  const points = isPointsSession(sessionName);
  return (
    <Scroller label={`${sessionName} team standings`}>
      <table className="w-full min-w-[28rem] border-collapse text-sm">
        <caption className="sr-only">{`${sessionName} team standings`}</caption>
        <thead>
          <tr>
            <th scope="col" className={`${th} w-12`}>
              <abbr title="Position" className="no-underline">Pos</abbr>
            </th>
            <th scope="col" className={th}>Team</th>
            <th scope="col" className={th}>Drivers</th>
            <th scope="col" className={`${th} pr-3 text-right`}>{points ? <abbr title="Points" className="no-underline">Pts</abbr> : 'Best'}</th>
          </tr>
        </thead>
        <Stagger key={motionKey} as="tbody" step={0.04} amount={0.05}>
          {teams.map((t, i) => (
            <StaggerItem as="tr" kind="slide" key={t.team} className={`border-t border-line/70 ${i < 3 ? 'bg-raised/60' : ''} transition-colors hover:bg-raised/80`}>
              <th scope="row" className={`${td} text-left font-normal`}>
                <span className={`${mono} ${i < 3 ? 'font-semibold text-ink' : 'text-muted'}`}>{i + 1}</span>
              </th>
              <td className={td}>
                <span className="flex items-center gap-2.5 whitespace-nowrap">
                  <TeamMarker colour={t.colour} tall />
                  <span className="font-semibold text-ink">{t.team}</span>
                </span>
              </td>
              <td className={`${td} ${mono} whitespace-nowrap text-muted`}>{t.drivers.join(' / ')}</td>
              <td className={`${td} ${mono} pr-3 text-right ${points && t.points > 0 ? 'font-semibold text-gold' : 'text-ink'}`}>
                {points ? t.points : t.bestPosition != null ? `P${t.bestPosition}` : ''}
              </td>
            </StaggerItem>
          ))}
        </Stagger>
      </table>
    </Scroller>
  );
}

function TableSkeleton() {
  return (
    <div role="status" aria-busy="true" className="mt-4 overflow-hidden rounded-lg border border-line">
      <span className="sr-only">Loading results</span>
      <div className="flex gap-4 border-b border-line px-3 py-3">
        {['w-8', 'w-8', 'w-24', 'w-20', 'ml-auto w-10', 'w-16'].map((w, i) => (
          <Skeleton key={i} variant="shimmer" className={`h-3 rounded-sm ${w}`} />
        ))}
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-line/70 px-3 py-2.5 first:border-t-0">
          <Skeleton variant="shimmer" className="h-4 w-6 rounded-sm" />
          <Skeleton variant="shimmer" className="h-4 w-6 rounded-sm" />
          <Skeleton variant="shimmer" className="size-8 shrink-0 rounded-full" />
          <Skeleton variant="shimmer" className="h-4 w-32 rounded-sm" />
          <Skeleton variant="shimmer" className="ml-auto h-4 w-20 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-dashed border-line px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
      <p className="max-w-[48ch]">{children}</p>
      {action}
    </div>
  );
}

/* ---------- the hub ---------- */

export default function ResultsHub({ sessions }: { sessions: RaceSession[] }) {
  const tabs = useMemo(() => sessionTabs(sessions), [sessions]);
  const initial = useMemo(() => defaultSessionKey(sessions), [sessions]);
  const [selected, setSelected] = useState<number | null>(initial);
  const [view, setView] = useState<View>('drivers');
  const [loads, setLoads] = useState<Record<number, Load>>({});
  const [retry, setRetry] = useState(0);
  const [fastest, setFastest] = useState<Record<number, { driverNumber: number; seconds: number; lapNumber: number | null } | null>>({});

  useEffect(() => setSelected(initial), [initial]);

  const current = tabs.find((t) => t.session.key === selected) ?? null;
  const kind = current ? sessionKind(current.session.name) : 'race';

  useEffect(() => {
    if (!current?.available) return;
    const key = current.session.key;
    let live = true;
    setLoads((m) => (m[key]?.state === 'ok' ? m : { ...m, [key]: { state: 'loading' } }));
    fetchResults(key)
      .then((rows) => live && setLoads((m) => ({ ...m, [key]: { state: 'ok', rows } })))
      .catch(() => live && setLoads((m) => ({ ...m, [key]: { state: 'error' } })));
    return () => {
      live = false;
    };
  }, [current?.session.key, current?.available, retry]);

  // Fastest lap marker for the race and sprint (silent on failure: the table works without it).
  const load = current ? loads[current.session.key] : undefined;
  const hasRows = load?.state === 'ok' && load.rows.length > 0;
  useEffect(() => {
    if (!current || !hasRows || (kind !== 'race' && kind !== 'sprint')) return;
    const key = current.session.key;
    if (key in fastest) return;
    let live = true;
    fetchLaps(key)
      .then((laps) => live && setFastest((m) => ({ ...m, [key]: fastestLapOf(laps) })))
      .catch(() => live && setFastest((m) => ({ ...m, [key]: null })));
    return () => {
      live = false;
    };
  }, [current, hasRows, kind, fastest]);

  const roving = useRovingTabs(
    tabs.map((t) => t.session.key),
    (k) => tabs.find((t) => t.session.key === k)?.available ?? false,
    setSelected,
  );

  const panelId = 'results-panel';
  const fl = current ? fastest[current.session.key] : null;
  const rows = load?.state === 'ok' ? load.rows : [];
  const flRow = fl ? rows.find((r) => r.number === fl.driverNumber) : undefined;
  const winner = rows.find((r) => r.position === 1);
  const motionKey = `${current?.session.key ?? 'none'}-${view}`;

  return (
    <div>
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        <div role="tablist" aria-label="Session" className="flex min-w-max gap-1 border-b border-line">
          {tabs.map((t) => {
            const on = t.session.key === selected;
            return (
              <button
                key={t.session.key}
                ref={roving.ref(t.session.key)}
                id={`results-tab-${t.session.key}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={panelId}
                aria-disabled={!t.available || undefined}
                disabled={!t.available}
                tabIndex={on || (selected == null && t === tabs.find((x) => x.available)) ? 0 : -1}
                onClick={() => t.available && setSelected(t.session.key)}
                onKeyDown={(e) => roving.onKeyDown(e, t.session.key)}
                className={`relative flex min-h-12 flex-col items-start justify-center px-3 pb-2 pt-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                  on ? 'font-semibold text-ink' : t.available ? 'text-muted hover:text-ink' : 'cursor-not-allowed text-muted/60'
                }`}
              >
                <span className="whitespace-nowrap">
                  <span className="sm:hidden">{shortSessionLabel(t.session.name)}</span>
                  <span className="hidden sm:inline">{t.session.name}</span>
                </span>
                {t.note && <span className="font-mono text-[0.625rem] uppercase tracking-widest">{t.note}</span>}
                {on && <ActiveKerb layoutId="results-session-kerb" className="inset-x-2 -bottom-px h-[3px]" />}
              </button>
            );
          })}
        </div>
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={current ? `results-tab-${current.session.key}` : undefined}
        aria-label={current ? undefined : 'Results'}
        className="min-w-0"
      >
        {!current && <Notice>Results appear shortly after the session ends.</Notice>}

        {current && (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="Standings view"
                idPrefix="results-view"
                layoutId="results-view-pill"
                options={[
                  { key: 'drivers', text: 'Drivers' },
                  { key: 'teams', text: 'Teams' },
                ]}
                value={view}
                onChange={setView}
              />
              {hasRows && (kind === 'race' || kind === 'sprint') && (
                <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  {winner && (
                    <div className="flex items-baseline gap-2">
                      <dt className="font-mono text-[0.6875rem] uppercase tracking-widest text-muted">Winner</dt>
                      <dd className="font-semibold">{winner.code}</dd>
                    </div>
                  )}
                  {fl && flRow && (
                    <div className="flex items-baseline gap-2">
                      <dt className="font-mono text-[0.6875rem] uppercase tracking-widest text-muted">Fastest lap</dt>
                      <dd className={`${mono} text-info`}>
                        <span className="mr-1.5 font-sans font-semibold text-ink">{flRow.code}</span>
                        <Ticker value={fl.seconds} from={fl.seconds + 3} format="lap" duration={0.9} />
                        {fl.lapNumber != null && <span className="ml-1.5 text-muted">lap {fl.lapNumber}</span>}
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </div>

            {(!load || load.state === 'loading') && <TableSkeleton />}
            {load?.state === 'error' && (
              <Notice
                action={
                  <button
                    type="button"
                    onClick={() => setRetry((n) => n + 1)}
                    className="press min-h-11 rounded-lg border border-line px-4 text-sm font-medium text-ink transition-colors hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Try again
                  </button>
                }
              >
                The results could not be loaded right now. The data service may be busy; try again in a minute.
              </Notice>
            )}
            {load?.state === 'ok' && load.rows.length === 0 && <Notice>Results appear shortly after the session ends.</Notice>}
            {hasRows &&
              (view === 'drivers' ? (
                <DriversTable rows={rows} kind={kind} sessionName={current.session.name} fastestNumber={flRow ? flRow.number : null} motionKey={motionKey} />
              ) : (
                <TeamsTable rows={rows} sessionName={current.session.name} motionKey={motionKey} />
              ))}
            {hasRows && <p className="mt-2 text-xs text-muted sm:hidden">Swipe the table sideways for every column.</p>}
          </>
        )}
      </div>
    </div>
  );
}
