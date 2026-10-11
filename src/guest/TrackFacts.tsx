import type { RaceFacts } from '../config/tracks/raceFacts';

/** The circuit's headline numbers: length, laps, race distance, turns and age. Sized by the width of the
 * card it sits in (container query), so it reads the same in a narrow column as on a phone. */
export function TrackFacts({ facts, season, className = '' }: { facts: RaceFacts; season: number; className?: string }) {
  const age = season - facts.firstGp;
  const items = [
    { label: 'Length', value: `${facts.lengthKm.toFixed(3)} km` },
    { label: 'Laps', value: String(facts.laps) },
    { label: 'Race distance', value: `${facts.raceDistanceKm.toFixed(1)} km` },
    { label: 'Turns', value: String(facts.turns) },
    { label: 'First GP', value: String(facts.firstGp), hint: age >= 0 ? `${age} years ago` : undefined },
  ];
  return (
    <dl className={`m-0 grid grid-cols-2 gap-2 @[30rem]:grid-cols-3 ${className}`}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0 rounded-md last:col-span-2 border border-line bg-raised/70 px-3 py-2">
          <dt className="block font-mono text-[0.625rem] uppercase tracking-[0.14em] text-muted">{it.label}</dt>
          <dd className="m-0">
            <span className="mt-0.5 block font-mono text-base font-semibold tabular-nums text-ink sm:text-lg">{it.value}</span>
            {it.hint && <span className="mt-0.5 block text-xs text-muted">{it.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}
