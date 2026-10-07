export interface TrackData {
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

export interface TrackCoverage {
  raceId: string;
  circuitId: string | null;
  status: 'available' | 'unavailable';
  reason?: string;
}
