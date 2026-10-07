import { useEffect, useId, useMemo, useRef } from 'react';
import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { trackForRace } from '../config/tracks';
import { TRACK_DRAW_MS } from '../lib/motion';
import { distanceFractions, parsePolylinePath, pointAtFraction } from '../lib/trackGeometry';
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
      {animate && !isChequered && <LapRunner d={t.d} />}
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

/** Trail layers: long faint tail under a short bright core. Lengths are fractions of the lap. */
const TRAILS = [
  { len: 0.07, width: 6, opacity: 0.18 },
  { len: 0.035, width: 9, opacity: 0.35 },
  { len: 0.014, width: 12, opacity: 0.7 },
];

/** Kart dot that leads the draw-on: it runs one lap in exactly the draw duration, linearly by
 * distance (like the dash-offset draw), so it always sits at the tip of the line being drawn, with a
 * short fading trail, then fades out. Position is written straight to the DOM from a motion value
 * (no React state per frame). Not rendered under reduced motion (the line is simply drawn). Lasts
 * the owner's draw duration and stops: no endless loop. */
function LapRunner({ d }: { d: string }) {
  const reduce = useReducedMotion();
  const geo = useMemo(() => {
    const pts = parsePolylinePath(d);
    return { pts, fracs: distanceFractions(pts) };
  }, [d]);
  const progress = useMotionValue(0);
  const opacity = useMotionValue(1);
  const groupRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const trailRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (reduce || geo.pts.length < 2) return;
    progress.set(0);
    opacity.set(1);
    const lap = animate(progress, 1, { duration: TRACK_DRAW_MS / 1000, ease: 'linear' });
    const fade = animate(opacity, 0, { duration: 0.5, delay: TRACK_DRAW_MS / 1000, ease: 'easeOut' });
    return () => {
      lap.stop();
      fade.stop();
    };
  }, [reduce, geo, progress, opacity]);

  useMotionValueEvent(progress, 'change', (v) => {
    const p = pointAtFraction(geo.pts, geo.fracs, Math.min(v, 1));
    headRef.current?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    TRAILS.forEach((tr, i) => trailRefs.current[i]?.setAttribute('stroke-dashoffset', String(tr.len - v)));
  });
  useMotionValueEvent(opacity, 'change', (v) => groupRef.current?.setAttribute('opacity', v.toFixed(3)));

  if (reduce || geo.pts.length < 2) return null;
  const start = geo.pts[0];
  return (
    <g ref={groupRef} aria-hidden="true" pointerEvents="none">
      {TRAILS.map((tr, i) => (
        <path
          key={i}
          ref={(el) => {
            trailRefs.current[i] = el;
          }}
          d={d}
          pathLength={1}
          fill="none"
          stroke="var(--color-ink)"
          strokeOpacity={tr.opacity}
          strokeWidth={tr.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${tr.len} 2`}
          strokeDashoffset={tr.len}
        />
      ))}
      <g ref={headRef} transform={`translate(${start.x} ${start.y})`}>
        <circle r={26} fill="var(--color-accent)" opacity={0.25} />
        <circle r={13} fill="var(--color-ink)" stroke="var(--color-accent)" strokeWidth={5} />
      </g>
    </g>
  );
}
