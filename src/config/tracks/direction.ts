import type { TrackDirection } from './types';

/** The TRUE racing direction of each circuit, as seen from above (SVG screen sense). A fact about the circuit:
 * the point order of the generated geometry comes from the source GeoJSON and can be either way round, so the
 * direction is never derived from it. Keyed by circuit id (the file name under ./data). */
export const TRACK_DIRECTION: Record<string, TrackDirection> = {
  baku: 'ccw',
  cota: 'ccw',
  interlagos: 'ccw',
  'istanbul-park': 'ccw',
  jeddah: 'ccw',
  'las-vegas': 'ccw',
  'marina-bay': 'ccw',
  miami: 'ccw',
  'yas-marina': 'ccw',
  'albert-park': 'cw',
  'gilles-villeneuve': 'cw',
  'hermanos-rodriguez': 'cw',
  hungaroring: 'cw',
  lusail: 'cw',
  madring: 'cw',
  monaco: 'cw',
  monza: 'cw',
  portimao: 'cw',
  'red-bull-ring': 'cw',
  sakhir: 'cw',
  sepang: 'cw',
  shanghai: 'cw',
  silverstone: 'cw',
  spa: 'cw',
  suzuka: 'cw',
};
