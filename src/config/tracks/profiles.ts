/** R41: one precomputed lap trace per circuit (see scripts/build-track-profiles.mjs). `pts` are [x, y, z] in
 * OpenF1's top-down frame; z is altitude in decimetres (indicative GPS-style telemetry, not a surveyed
 * profile). `s1End` / `s2End` are the indices where sector 1 and 2 end; index 0 is the start/finish line. */
export interface TrackProfile {
  circuitKey: number;
  sourceSession: number;
  driver: number;
  lap: number;
  lapTime: number;
  n: number;
  s1End: number;
  s2End: number;
  pts: [number, number, number][];
}

// Lazy chunks: a visitor only downloads the one circuit they open (~3 KB).
const loaders = import.meta.glob<{ default: TrackProfile }>('./profile/*.json');

export async function loadTrackProfile(circuitKey: number): Promise<TrackProfile | null> {
  const load = loaders[`./profile/${circuitKey}.json`];
  if (!load) return null;
  try {
    return (await load()).default;
  } catch {
    return null;
  }
}
