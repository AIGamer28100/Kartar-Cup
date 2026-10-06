import { useId } from 'react';
import { trackForRace } from '../config/tracks';
import type { TrackData } from '../config/tracks/types';
import type { RaceState } from './RaceStateDisplay';

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
  const maskId = `track-reveal-${useId().replace(/:/g, '')}`;
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
      {isChequered ? (
        <ChequeredLine d={t.d} maskId={maskId} reveal={animate} />
      ) : (
        <path
          d={t.d}
          pathLength={1}
          className={`stroke-accent ${draw}`}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ stroke: trackColor }}
        />
      )}
      {t.start && <circle cx={t.start.x} cy={t.start.y} r={9} className="fill-ink stroke-accent" strokeWidth={3} />}
    </svg>
  );
}

/** Chequered-flag racing line: three rows of alternating black/white squares (the centre row is
 * phase-shifted, so it reads as a flag, not stripes). The group is revealed by a mask path that
 * draws on exactly like the normal track outline (.track-draw), then the squares keep running
 * round the lap (.track-chequered). Dashes use real user units (no pathLength) so square size
 * does not depend on circuit length. Remounts, and so replays the draw, when the state changes
 * to chequered. */
function ChequeredLine({ d, maskId, reveal }: { d: string; maskId: string; reveal: boolean }) {
  const join = { strokeLinejoin: 'round' as const };
  return (
    <>
      {reveal && (
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-2000} y={-2000} width={5000} height={5000}>
          <path
            d={d}
            pathLength={1}
            className="track-draw"
            stroke="#fff"
            strokeWidth={44}
            strokeLinecap="round"
            {...join}
          />
        </mask>
      )}
      <g mask={reveal ? `url(#${maskId})` : undefined} {...join}>
        <path d={d} stroke="var(--color-chequer-dark)" strokeWidth={30} />
        <path d={d} className="track-chequered" stroke="var(--color-chequer-light)" strokeWidth={30} />
        <path d={d} stroke="var(--color-chequer-light)" strokeWidth={10} />
        <path d={d} className="track-chequered" stroke="var(--color-chequer-dark)" strokeWidth={10} />
      </g>
    </>
  );
}
