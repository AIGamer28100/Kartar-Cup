import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { ActivePill, Stagger, StaggerItem, Ticker } from '../components/motion';
import { SPRING } from '../lib/motion';
import { fetchConstructorStandings, fetchDriverStandings, type Standings } from '../lib/f1api';
import { Eyebrow, H2, Reveal } from './parts';

type Tab = 'drivers' | 'constructors';
const SHOWN = 11;

/** The bar observes its full-width TRACK, not the scaled bar: a bar at scaleX(0) is zero-width and,
 * on a phone, sits inside the side gutter an all-sides scroll margin would exclude — it would never
 * count as in view. Margins are vertical-only for the same reason. */
function Bar({ ratio, leader, delay }: { ratio: number; leader: boolean; delay: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px 0px' });
  const reduce = useReducedMotion();
  return (
    <span
      ref={ref}
      className="col-span-3 h-2 overflow-hidden rounded-full bg-line/60 md:col-span-1"
      aria-hidden="true"
    >
      <motion.span
        className={`block h-full w-full origin-left rounded-full ${leader ? 'bg-gradient-brand' : 'bg-muted/50'}`}
        initial={false}
        animate={{ scaleX: reduce || inView ? ratio : 0 }}
        transition={reduce ? { duration: 0 } : { ...SPRING.soft, stiffness: 90, damping: 20, delay }}
      />
    </span>
  );
}

function Rows({ standings }: { standings: Standings }) {
  const rows = standings.rows.slice(0, SHOWN);
  const max = Math.max(1, ...rows.map((r) => r.points));
  return (
    <Stagger as="ol" step={0.045} className="mt-6 divide-y divide-line border-y border-line">
      {rows.map((r, i) => (
        <StaggerItem
          as="li"
          kind="slide"
          key={r.name}
          className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-4 gap-y-2 py-3 md:grid-cols-[2.5rem_14rem_1fr_5rem]"
        >
          <span className={`font-mono text-sm ${i === 0 ? 'text-ink' : 'text-muted'}`}>{r.position}</span>
          <span className="min-w-0 md:order-none">
            <span className="block truncate font-medium text-ink">{r.name}</span>
            {r.team && <span className="block truncate text-sm text-muted">{r.team}</span>}
          </span>
          <span className="text-right font-mono text-lg text-ink md:order-last">
            <Ticker value={r.points} />
          </span>
          <Bar ratio={r.points / max} leader={i === 0} delay={0.1 + i * 0.05} />
        </StaggerItem>
      ))}
    </Stagger>
  );
}

/** Real championship standings from the official results feed (Jolpica), shown with motion:
 * bars sweep out proportionally to points and the numbers count up as the section arrives. Renders
 * nothing if the feed is unreachable or the season has no standings yet — never placeholder rows. */
export default function ChampionshipSection({ season }: { season: number }) {
  const [drivers, setDrivers] = useState<Standings | null | undefined>(undefined);
  const [constructors, setConstructors] = useState<Standings | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('drivers');

  useEffect(() => {
    let cancelled = false;
    void fetchDriverStandings(season).then((s) => !cancelled && setDrivers(s));
    void fetchConstructorStandings(season).then((s) => !cancelled && setConstructors(s));
    return () => {
      cancelled = true;
    };
  }, [season]);

  const loading = drivers === undefined && constructors === undefined;
  if (!loading && !drivers && !constructors) return null;

  const active = tab === 'drivers' ? drivers : constructors;
  const round = (drivers ?? constructors)?.round;

  return (
    <div>
      <Reveal>
        <Eyebrow>{season} championship</Eyebrow>
        <h2 className={`mt-3 ${H2}`}>Where the title stands</h2>
        {round ? (
          <p className="mt-3 text-sm text-muted">After round {round} · official results</p>
        ) : null}
      </Reveal>
      <Reveal index={1} className="mt-6 inline-flex rounded-lg border border-line p-1">
        {(['drivers', 'constructors'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`relative isolate min-h-11 rounded-md px-4 text-sm font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              tab === t ? 'text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            {tab === t && <ActivePill layoutId="champ-tab" />}
            {t}
          </button>
        ))}
      </Reveal>
      {loading ? (
        <div className="shimmer mt-6 h-64 rounded-lg bg-raised" aria-hidden="true" />
      ) : active ? (
        <Rows key={tab} standings={active} />
      ) : (
        <p className="mt-6 text-muted">No {tab} standings yet.</p>
      )}
    </div>
  );
}
