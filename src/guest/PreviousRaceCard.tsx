import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Trophy } from '@phosphor-icons/react';
import type { PodiumDriver } from '../components/RaceStateDisplay';
import Skeleton from '../components/Skeleton';
import type { RaceInfo } from '../config/calendar';
import { portraitUrl } from '../lib/portrait';
import { fetchPodiumForRace } from '../lib/podium';
import { Reveal } from './parts';

/* The Previous card on /events: the last finished race and who won it. The podium comes from the same
 * OpenF1 fetch the home page uses (lib/podium: never invented, any failure returns null), and the card
 * says plainly when there is no result. Faces are hot-linked from F1's media CDN, never re-hosted. */

type PodiumState = { state: 'loading' } | { state: 'ok'; podium: PodiumDriver[] } | { state: 'none' };

const surname = (name: string) => name.split(' ').slice(-1)[0] || name;
const firstName = (name: string) => name.split(' ').slice(0, -1).join(' ');

/** Team-coloured tile with the driver's portrait standing on its bottom edge; monogram when there is no
 * usable image. Decorative: the name is always printed beside it. */
function Portrait({ driver, className, cols, plain = false }: { driver: PodiumDriver; className: string; cols: number; plain?: boolean }) {
  const [broken, setBroken] = useState(false);
  const src = portraitUrl(driver.headshotUrl, cols);
  return (
    <span
      className={`relative flex shrink-0 items-end justify-center overflow-hidden ${className}`}
      style={plain ? undefined : { background: `linear-gradient(165deg, color-mix(in srgb, ${driver.colour} 60%, transparent), color-mix(in srgb, ${driver.colour} 12%, var(--color-base)))` }}
    >
      {src && !broken ? (
        <img src={src} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-contain object-bottom" />
      ) : (
        <span className="m-auto font-mono text-sm font-semibold tracking-wider text-ink">{driver.code}</span>
      )}
    </span>
  );
}

/** Winner tile (large portrait, name, team, race time) with the two runners-up as rows beneath. */
function Podium({ podium }: { podium: PodiumDriver[] }) {
  const [w, ...rest] = podium;
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div
        className="@container relative flex min-h-40 flex-1 overflow-hidden rounded-lg border border-line"
        style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${w.colour} 28%, var(--color-raised)), var(--color-raised))` }}
      >
        <div className="relative z-10 flex min-w-0 flex-1 flex-col justify-end p-4">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-gold">
            <Trophy size={14} weight="fill" aria-hidden="true" /> Winner
          </p>
          <p className="mt-2 text-sm text-muted">{firstName(w.name)}</p>
          {/* Container query: the tile is 246px wide in the narrowest card (1024px screen), 330px+ otherwise. */}
          <p className="break-words text-lg font-semibold leading-none text-ink @[18rem]:text-2xl">{surname(w.name)}</p>
          <p className="mt-2 text-sm text-muted">{w.team}</p>
          {w.detail && <p className="mt-1 font-mono text-xs tabular-nums text-muted">{w.detail}</p>}
        </div>
        <Portrait driver={w} plain cols={5} className="w-[42%] self-end @[18rem]:w-[46%]" />
      </div>
      <ol start={2} className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {rest.map((d) => (
          <li key={d.position} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
            <span className="w-5 font-num text-lg font-extrabold italic tabular-nums text-muted">{d.position}</span>
            <Portrait driver={d} cols={2} className="size-10 rounded-lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{d.name}</span>
              <span className="block truncate text-xs text-muted">
                {d.team}
                {d.detail && <span className="font-mono tabular-nums">{` · ${d.detail}`}</span>}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CardView({
  race,
  range,
  circuit,
  podium,
  index = 0,
}: {
  race: Pick<RaceInfo, 'id' | 'round' | 'name'>;
  /** Weekend dates, already formatted ("02-04 OCT 2026"). */
  range: string;
  /** Circuit and place line. */
  circuit: string;
  podium: PodiumState;
  index?: number;
}) {
  return (
    <Reveal
      index={index}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border border-line bg-raised transition-colors hover:border-accent"
    >
      <div className="flex flex-1 flex-col p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">
          Round {String(race.round).padStart(2, '0')} · {range}
        </p>
        <h3 className="mt-3 text-pretty text-xl font-medium leading-tight text-ink">
          <Link
            to={`/races/${race.id}`}
            className="after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {race.name}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-muted">{circuit}</p>

        <div className="mt-5 flex flex-1 flex-col">
          {podium.state === 'loading' && <Skeleton variant="shimmer" className="min-h-40 w-full flex-1 rounded-lg" />}
          {podium.state === 'ok' && <Podium podium={podium.podium} />}
          {podium.state === 'none' && (
            <p className="flex min-h-24 flex-1 items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
              Results aren&rsquo;t available right now.
            </p>
          )}
        </div>

        <p className="inline-flex min-h-11 items-center gap-2 pt-4 text-sm font-medium text-accent-text">
          Full results
          <ArrowRight size={16} weight="regular" aria-hidden="true" className="transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none" />
        </p>
      </div>
    </Reveal>
  );
}

/** The live card: fetches the podium for the race. */
export function PreviousRaceCard({ race, range, circuit, index }: { race: RaceInfo; range: string; circuit: string; index?: number }) {
  const [podium, setPodium] = useState<PodiumState>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    setPodium({ state: 'loading' });
    void fetchPodiumForRace(race).then((p) => live && setPodium(p ? { state: 'ok', podium: p } : { state: 'none' }));
    return () => {
      live = false;
    };
  }, [race]);
  return <CardView race={race} range={range} circuit={circuit} podium={podium} index={index} />;
}
