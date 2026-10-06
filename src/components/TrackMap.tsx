import { trackForRace } from '../config/tracks';
import type { TrackData } from '../config/tracks/types';

interface TrackMapProps {
  raceId?: string;
  track?: TrackData;
  animate?: boolean;
  className?: string;
  title?: string;
  state?: RaceState;
}

/** Stroke widths are in viewBox units (all outlines use a 1000x1000 box) so they scale with the
 * SVG. Do NOT use vectorEffect="non-scaling-stroke" here: it makes dash lengths screen px while
 * pathLength normalises in user units, so the draw-on animation finished long before its duration.
 * The draw keyframes live in src/styles/tokens.css (.track-draw). */
export default function TrackMap({ raceId, track, animate = false, className = '', title, state }: TrackMapProps) {
  const t = track ?? (raceId ? trackForRace(raceId) : null);
  if (!t) return null;

  const stateKey = typeof state === 'object' ? state.type : state;

  const getTrackColor = () => {
    if (stateKey === 'in-progress') return 'var(--color-ok)';
    if (stateKey === 'red-flag') return 'var(--color-accent)';
    if (stateKey === 'yellow-flag' || stateKey === 'safety-car' || stateKey === 'virtual-safety-car') return 'var(--color-gold)';
    if (stateKey === 'chequered-flag' || stateKey === 'completed') return 'var(--color-ink)';
    return 'var(--color-line)';
  };

  const isChequered = stateKey === 'chequered-flag' || stateKey === 'completed';
  const trackColor = getTrackColor();
  const draw = animate ? 'track-draw' : '';
  const label = title ?? `Circuit layout: ${t.name}`;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={t.viewBox}
      className={`block w-full h-auto ${className}`}
      fill="none"
    >
      <path
        d={t.d}
        pathLength={1}
        className="stroke-line"
        strokeWidth={36}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={t.d}
        pathLength={1}
        className={`stroke-accent ${draw} ${isChequered ? 'track-chequered' : ''}`}
        strokeWidth={11}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ stroke: isChequered ? undefined : trackColor }}
      />
      {t.start && <circle cx={t.start.x} cy={t.start.y} r={9} className="fill-ink stroke-accent" strokeWidth={3} />}
    </svg>
  );
}
