export interface TrackShape {
  id: string;
  name: string;
  locality: string;
  country: string;
  lengthKm?: number | null;
  viewBox: string;
  /** SVG path (M/L/Z) in viewBox coordinates. */
  d: string;
  /** Start/finish point; null when the source does not mark it. */
  start: { x: number; y: number } | null;
}

/** The real-world racing direction as seen from above (SVG screen sense). */
export type TrackDirection = 'cw' | 'ccw';

export interface TrackData extends TrackShape {
  /** TRUE racing direction of the circuit (a fact about the circuit, see direction.ts), not the
   * point order of `d`, which comes from the source GeoJSON and can be either way round. */
  direction: TrackDirection;
}

export interface TrackCoverage {
  raceId: string;
  circuitId: string | null;
  status: 'available' | 'unavailable';
  reason?: string;
}
