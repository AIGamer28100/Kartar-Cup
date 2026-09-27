import { trackForRace } from '../config/tracks';
import type { TrackData } from '../config/tracks/types';

interface TrackMapProps {
  raceId?: string;
  track?: TrackData;
  animate?: boolean;
  className?: string;
  title?: string;
}

export default function TrackMap({ raceId, track, animate = false, className = '', title }: TrackMapProps) {
  const t = track ?? (raceId ? trackForRace(raceId) : null);
  if (!t) return null;
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
      {animate && (
        <style>{`@keyframes track-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@media (prefers-reduced-motion:no-preference){.track-draw{stroke-dasharray:1;animation:track-draw 2.4s ease-out forwards}}`}</style>
      )}
      <path
        d={t.d}
        pathLength={1}
        className="stroke-line"
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={t.d}
        pathLength={1}
        className={`stroke-accent ${draw}`}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {t.start && <circle cx={t.start.x} cy={t.start.y} r={9} className="fill-ink stroke-accent" strokeWidth={3} />}
    </svg>
  );
}
