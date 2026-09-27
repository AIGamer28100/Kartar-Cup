// Offline, reproducible: scripts/data/circuits/*.geojson -> src/config/tracks/data/*.ts + index.ts
// Source: bacinger/f1-circuits (MIT). See scripts/data/SOURCES.md. Run: node scripts/build-tracks.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW = path.join(ROOT, 'scripts/data/circuits');
const OUT = path.join(ROOT, 'src/config/tracks');
const VIEW = 1000;
const PAD = 60;
const MAX_POINTS = 300;

// slug -> source file id, display data. Venue names verified per race in SOURCES.md.
const CIRCUITS = {
  baku: ['az-2016', 'Baku City Circuit', 'Baku', 'Azerbaijan'],
  sepang: ['my-1999', 'Sepang International Circuit', 'Sepang', 'Malaysia'],
  'marina-bay': ['sg-2008', 'Marina Bay Street Circuit', 'Singapore', 'Singapore'],
  cota: ['us-2012', 'Circuit of the Americas', 'Austin', 'United States'],
  'hermanos-rodriguez': ['mx-1962', 'Autodromo Hermanos Rodriguez', 'Mexico City', 'Mexico'],
  interlagos: ['br-1940', 'Autodromo Jose Carlos Pace (Interlagos)', 'Sao Paulo', 'Brazil'],
  'las-vegas': ['us-2023', 'Las Vegas Street Circuit', 'Las Vegas', 'United States'],
  lusail: ['qa-2004', 'Lusail International Circuit', 'Lusail', 'Qatar'],
  'yas-marina': ['ae-2009', 'Yas Marina Circuit', 'Abu Dhabi', 'United Arab Emirates'],
  sakhir: ['bh-2002', 'Bahrain International Circuit', 'Sakhir', 'Bahrain'],
  jeddah: ['sa-2021', 'Jeddah Corniche Circuit', 'Jeddah', 'Saudi Arabia'],
  'albert-park': ['au-1953', 'Albert Park Circuit', 'Melbourne', 'Australia'],
  suzuka: ['jp-1962', 'Suzuka International Racing Course', 'Suzuka', 'Japan'],
  shanghai: ['cn-2004', 'Shanghai International Circuit', 'Shanghai', 'China'],
  miami: ['us-2022', 'Miami International Autodrome', 'Miami', 'United States'],
  'gilles-villeneuve': ['ca-1978', 'Circuit Gilles-Villeneuve', 'Montreal', 'Canada'],
  monaco: ['mc-1929', 'Circuit de Monaco', 'Monte Carlo', 'Monaco'],
  portimao: ['pt-2008', 'Autodromo Internacional do Algarve', 'Portimao', 'Portugal'],
  silverstone: ['gb-1948', 'Silverstone Circuit', 'Silverstone', 'Great Britain'],
  'red-bull-ring': ['at-1969', 'Red Bull Ring', 'Spielberg', 'Austria'],
  spa: ['be-1925', 'Circuit de Spa-Francorchamps', 'Spa', 'Belgium'],
  hungaroring: ['hu-1986', 'Hungaroring', 'Budapest', 'Hungary'],
  monza: ['it-1922', 'Autodromo Nazionale Monza', 'Monza', 'Italy'],
  madring: ['es-2026', 'Circuito de Madring', 'Madrid', 'Spain'],
  'istanbul-park': ['tr-2005', 'Istanbul Park', 'Istanbul', 'Turkiye'],
};

// race id -> circuit slug (null = unavailable, with reason). Ids match src/config/calendar.
const RACE_TO_CIRCUIT = {
  '2026-r15-azerbaijan': 'baku',
  '2026-r16-malaysia': 'sepang',
  '2026-r17-singapore': 'marina-bay',
  '2026-r18-united-states': 'cota',
  '2026-r19-mexico': 'hermanos-rodriguez',
  '2026-r20-brazil': 'interlagos',
  '2026-r21-las-vegas': 'las-vegas',
  '2026-r22-qatar': 'lusail',
  '2026-r23-abu-dhabi': 'yas-marina',
  '2027-r1-bahrain': 'sakhir',
  '2027-r2-saudi-arabia': 'jeddah',
  '2027-r3-australia': 'albert-park',
  '2027-r4-japan': 'suzuka',
  '2027-r5-china': 'shanghai',
  '2027-r6-miami': 'miami',
  '2027-r7-canada': 'gilles-villeneuve',
  '2027-r8-monaco': 'monaco',
  '2027-r9-portugal': 'portimao',
  '2027-r10-great-britain': 'silverstone',
  '2027-r11-austria': 'red-bull-ring',
  '2027-r12-belgium': 'spa',
  '2027-r13-hungary': 'hungaroring',
  '2027-r14-italy': 'monza',
  '2027-r15-spain': 'madring',
  '2027-r16-azerbaijan': 'baku',
  '2027-r17-turkiye': 'istanbul-park',
  '2027-r18-singapore': 'marina-bay',
  '2027-r19-united-states': 'cota',
  '2027-r20-mexico': 'hermanos-rodriguez',
  '2027-r21-brazil': 'interlagos',
  '2027-r22-las-vegas': 'las-vegas',
  '2027-r23-qatar': 'lusail',
  '2027-r24-abu-dhabi': 'yas-marina',
};
const UNAVAILABLE_REASON = {};

function project(coords) {
  const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  const lon0 = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const R = 6371008.8;
  const k = Math.cos((lat0 * Math.PI) / 180);
  return coords.map(([lon, lat]) => [
    ((lon - lon0) * Math.PI / 180) * R * k,
    ((lat - lat0) * Math.PI / 180) * R,
  ]);
}

function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function dp(pts, eps) {
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let max = -1, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > max) { max = d; idx = i; }
    }
    if (max > eps && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// Source lines are already ~80-170 pts; simplify only when above MAX_POINTS.
function simplify(pts) {
  if (pts.length <= MAX_POINTS) return pts;
  let eps = 0.5, out = pts;
  while (out.length > MAX_POINTS) { out = dp(pts, eps); eps *= 1.3; }
  return out;
}

function normalise(pts) {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => -p[1]); // north up
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const scale = (VIEW - 2 * PAD) / Math.max(maxX - minX, maxY - minY);
  const ox = (VIEW - (maxX - minX) * scale) / 2, oy = (VIEW - (maxY - minY) * scale) / 2;
  return pts.map((p, i) => [
    +((p[0] - minX) * scale + ox).toFixed(1),
    +((ys[i] - minY) * scale + oy).toFixed(1),
  ]);
}

fs.mkdirSync(path.join(OUT, 'data'), { recursive: true });
const ident = (slug) => slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const slugs = Object.keys(CIRCUITS);

for (const slug of slugs) {
  const [src, name, locality, country] = CIRCUITS[slug];
  const gj = JSON.parse(fs.readFileSync(path.join(RAW, `${src}.geojson`), 'utf8'));
  const feat = gj.features ? gj.features[0] : gj;
  if (feat.geometry.type !== 'LineString') throw new Error(`${src}: not a LineString`);
  let coords = feat.geometry.coordinates;
  const first = coords[0], last = coords[coords.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) coords = coords.slice(0, -1);
  const pts = normalise(simplify(project(coords)));
  const d = 'M' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L') + ' Z';
  const len = feat.properties?.length;
  const lengthKm = typeof len === 'number' ? +(len / 1000).toFixed(3) : null;
  const body =
    `// Generated by scripts/build-tracks.mjs from bacinger/f1-circuits (MIT), source id ${src}. Do not edit.\n` +
    `import type { TrackData } from '../types';\n\n` +
    `export const ${ident(slug)}: TrackData = {\n` +
    `  id: ${JSON.stringify(slug)},\n  name: ${JSON.stringify(name)},\n  locality: ${JSON.stringify(locality)},\n` +
    `  country: ${JSON.stringify(country)},\n  lengthKm: ${lengthKm},\n` +
    `  viewBox: '0 0 ${VIEW} ${VIEW}',\n  d: ${JSON.stringify(d)},\n  start: null,\n};\n`;
  fs.writeFileSync(path.join(OUT, 'data', `${slug}.ts`), body);
}

const imports = slugs.map((s) => `import { ${ident(s)} } from './data/${s}';`).join('\n');
const map = slugs.map((s) => `  ${JSON.stringify(s)}: ${ident(s)},`).join('\n');
const race = Object.entries(RACE_TO_CIRCUIT)
  .map(([r, s]) => `  ${JSON.stringify(r)}: ${JSON.stringify(s)},`).join('\n');
const cov = Object.entries(RACE_TO_CIRCUIT)
  .map(([r, s]) => s
    ? `  { raceId: ${JSON.stringify(r)}, circuitId: ${JSON.stringify(s)}, status: 'available' },`
    : `  { raceId: ${JSON.stringify(r)}, circuitId: null, status: 'unavailable', reason: ${JSON.stringify(UNAVAILABLE_REASON[r] ?? 'no data')} },`)
  .join('\n');

fs.writeFileSync(path.join(OUT, 'index.ts'),
`// Generated by scripts/build-tracks.mjs. Do not edit.
import type { TrackCoverage, TrackData } from './types';
${imports}

export type { TrackCoverage, TrackData } from './types';

export const TRACKS_BY_CIRCUIT: Record<string, TrackData> = {
${map}
};

/** Race id -> circuit id (venues verified; see scripts/data/SOURCES.md). */
export const CIRCUIT_BY_RACE: Record<string, string> = {
${race}
};

export const TRACK_COVERAGE: TrackCoverage[] = [
${cov}
];

export function trackForRace(raceId: string): TrackData | null {
  const circuit = CIRCUIT_BY_RACE[raceId];
  return circuit ? (TRACKS_BY_CIRCUIT[circuit] ?? null) : null;
}
`);
console.log(`built ${slugs.length} circuits, ${Object.keys(RACE_TO_CIRCUIT).length} races`);
