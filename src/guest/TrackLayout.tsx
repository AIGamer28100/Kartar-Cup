import { useMemo, useState } from 'react';
import type { TrackProfile } from '../config/tracks/profiles';

/* R41: ONE layout showing BOTH colour-coded sectors and elevation. Sector = line colour (with S1/S2/S3
 * labels on the track, so it never relies on colour alone); elevation = line thickness (thicker = higher),
 * with a profile strip below that shares the sector colouring and a cursor linked to the map. Elevation is
 * indicative (lap telemetry z, relative to the lowest point), not a surveyed profile. */

const SECTORS = [
  { id: 1, label: 'Sector 1', colour: 'var(--color-accent-text)' },
  { id: 2, label: 'Sector 2', colour: 'var(--color-gold)' },
  { id: 3, label: 'Sector 3', colour: 'var(--color-info)' },
] as const;

const W = 640;
const H = 400;
const PAD = 36;
const MIN_W = 4;
const MAX_W = 13;

function sectorOf(i: number, p: TrackProfile): 0 | 1 | 2 {
  return i < p.s1End ? 0 : i < p.s2End ? 1 : 2;
}

export default function TrackLayout({ profile, name }: { profile: TrackProfile; name: string }) {
  const [cursor, setCursor] = useState<number | null>(null);

  const geo = useMemo(() => {
    const xs = profile.pts.map((p) => p[0]);
    const ys = profile.pts.map((p) => p[1]);
    const zs = profile.pts.map((p) => p[2]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const scale = Math.min((W - 2 * PAD) / (maxX - minX || 1), (H - 2 * PAD) / (maxY - minY || 1));
    const offX = (W - (maxX - minX) * scale) / 2;
    const offY = (H - (maxY - minY) * scale) / 2;
    const zRange = maxZ - minZ;
    const pts = profile.pts.map(([x, y, z]) => ({
      x: offX + (x - minX) * scale,
      y: H - (offY + (y - minY) * scale), // OpenF1 y grows upward; SVG y grows downward
      rel: (z - minZ) / 10, // metres above the lowest point of the lap
      k: zRange > 0 ? (z - minZ) / zRange : 0.5,
    }));
    return { pts, zRangeM: zRange / 10, maxRel: zRange / 10 };
  }, [profile]);

  const { pts } = geo;
  const n = pts.length;
  const flat = geo.zRangeM < 6; // a nearly flat circuit: don't exaggerate noise into a fat/thin line

  // Elevation strip geometry.
  const SW = 640, SH = 120, SP = 8;
  const stripX = (i: number) => SP + (i / (n - 1)) * (SW - 2 * SP);
  const stripY = (rel: number) => SH - SP - (geo.maxRel > 0 ? (rel / geo.maxRel) * (SH - 2 * SP) : 0);

  const segs = [];
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const k = (a.k + b.k) / 2;
    segs.push(
      <line
        key={i}
        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
        stroke={SECTORS[sectorOf(i, profile)].colour}
        strokeWidth={flat ? (MIN_W + MAX_W) / 2 : MIN_W + k * (MAX_W - MIN_W)}
        strokeLinecap="round"
      />,
    );
  }

  const stripSegs = [];
  for (let i = 0; i < n - 1; i++) {
    stripSegs.push(
      <line
        key={i}
        x1={stripX(i)} y1={stripY(pts[i].rel)} x2={stripX(i + 1)} y2={stripY(pts[i + 1].rel)}
        stroke={SECTORS[sectorOf(i, profile)].colour}
        strokeWidth={3}
        strokeLinecap="round"
      />,
    );
  }

  const cur = cursor != null ? pts[cursor] : null;
  const label = (idx: number, text: string) => {
    const p = pts[Math.min(idx, n - 1)];
    return (
      <text key={text} x={p.x} y={p.y - 14} textAnchor="middle" className="fill-ink font-mono" style={{ fontSize: 13, fontWeight: 600 }} paintOrder="stroke" stroke="var(--color-base)" strokeWidth={4}>
        {text}
      </text>
    );
  };

  function onStripMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    setCursor(Math.round(f * (n - 1)));
  }

  return (
    <figure className="min-w-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${name} track layout with three colour-coded sectors; line thickness shows elevation, thicker is higher.`}
        className="h-auto w-full"
      >
        <g opacity={0.9}>{segs}</g>
        {label(Math.round(profile.s1End / 2), 'S1')}
        {label(Math.round((profile.s1End + profile.s2End) / 2), 'S2')}
        {label(Math.round((profile.s2End + n) / 2), 'S3')}
        {/* Start / finish: index 0 is the line, drawn as a bar across the direction of travel. */}
        <circle cx={pts[0].x} cy={pts[0].y} r={9} fill="var(--color-ink)" stroke="var(--color-base)" strokeWidth={3} />
        <text x={pts[0].x} y={pts[0].y + 26} textAnchor="middle" className="fill-ink font-mono" style={{ fontSize: 11 }} paintOrder="stroke" stroke="var(--color-base)" strokeWidth={4}>
          START / FINISH
        </text>
        {cur && (
          <g>
            <circle cx={cur.x} cy={cur.y} r={13} fill="none" stroke="var(--color-ink)" strokeWidth={3} />
            <circle cx={cur.x} cy={cur.y} r={4} fill="var(--color-ink)" />
          </g>
        )}
      </svg>

      <svg
        viewBox={`0 0 ${SW} ${SH}`}
        className="mt-3 h-auto w-full touch-pan-y"
        role="img"
        aria-label="Elevation profile around the lap, coloured by sector"
        onPointerMove={onStripMove}
        onPointerDown={onStripMove}
        onPointerLeave={() => setCursor(null)}
      >
        <line x1={SP} y1={SH - SP} x2={SW - SP} y2={SH - SP} stroke="currentColor" className="text-line" strokeWidth={1} />
        {stripSegs}
        {cursor != null && (
          <line x1={stripX(cursor)} y1={SP} x2={stripX(cursor)} y2={SH - SP} stroke="var(--color-ink)" strokeWidth={1.5} strokeDasharray="4 3" />
        )}
      </svg>

      <label className="mt-2 block text-sm text-muted">
        Explore the lap
        <input
          type="range"
          min={0}
          max={n - 1}
          value={cursor ?? 0}
          onChange={(e) => setCursor(Number(e.target.value))}
          className="mt-1 block w-full accent-accent"
          aria-valuetext={cur ? `Lap point ${cursor}, ${cur.rel.toFixed(1)} metres above the lowest point` : 'Start of lap'}
        />
      </label>
      <p className="mt-1 min-h-5 font-mono text-sm tabular-nums text-muted" aria-live="polite">
        {cur && cursor != null
          ? `${SECTORS[sectorOf(cursor, profile)].label} - ${cur.rel.toFixed(1)} m above the lowest point`
          : `Total elevation change about ${geo.zRangeM.toFixed(0)} m`}
      </p>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        {SECTORS.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-1.5 w-6 rounded-full" style={{ background: s.colour }} />
            {s.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-2 text-muted">
          <span aria-hidden="true" className="inline-flex items-center gap-0.5">
            <span className="inline-block h-0.5 w-3 rounded-full bg-current" />
            <span className="inline-block h-1.5 w-3 rounded-full bg-current" />
          </span>
          Thicker line = higher ground
        </span>
      </figcaption>
      <p className="mt-2 text-xs text-muted">
        Layout, sectors and elevation come from one real qualifying lap (OpenF1 telemetry). Elevation is indicative,
        measured relative to the lowest point.
      </p>
    </figure>
  );
}
