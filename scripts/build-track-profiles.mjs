// One-time build script (R41): precompute ONE track layout per circuit from a single real OpenF1 lap, with
// sector boundaries (S1/S2/S3) and elevation (z, decimetres) in the same trace, so the detail page can draw
// one SVG that shows both. Output: src/config/tracks/profile/<circuitKey>.json (~3 KB each).
// Run: node scripts/build-track-profiles.mjs [circuitKey ...]   (no args = all)
// Data: OpenF1 (CC BY-NC-SA 4.0), historical window only (>30 min after the session ended). Paced for the
// free tier (3 req/s, 30 req/min): 0.8 s spacing, retry with backoff on 429.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://api.openf1.org/v1';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'config', 'tracks', 'profile');

// circuit_key -> source session (pole / fastest lap). Sepang has no history: re-run with the 2026 Malaysia
// Qualifying session (11730) once it is >30 min over, then it replaces the FP2 trace.
const SOURCES = {
  144: { name: 'Baku', session: 11373 },
  12: { name: 'Sepang', session: 11728 },
  61: { name: 'Singapore', session: 9892 },
  9: { name: 'Austin', session: 9884 },
  65: { name: 'Mexico City', session: 9873 },
  14: { name: 'Interlagos', session: 9865 },
  152: { name: 'Las Vegas', session: 9854 },
  150: { name: 'Lusail', session: 9846 },
  70: { name: 'Yas Marina', session: 9835 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;

async function get(path, tries = 6) {
  for (let i = 1; i <= tries; i++) {
    const wait = Math.max(0, last + 800 - Date.now());
    if (wait) await sleep(wait);
    last = Date.now();
    const res = await fetch(`${BASE}${path}`, { headers: { 'User-Agent': 'kartar-cup-build-script (fan site, non-commercial)' } });
    if (res.status === 429) {
      await sleep(3000 * i);
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} for ${path}`);
    return res.json();
  }
  throw new Error(`gave up after ${tries} tries: ${path}`);
}

async function build(circuitKey, { name, session }) {
  const pole = await get(`/session_result?session_key=${session}&position=1`);
  const driver = pole?.[0]?.driver_number;
  if (!driver) throw new Error(`${name}: no P1 driver in session ${session}`);
  const laps = await get(`/laps?session_key=${session}&driver_number=${driver}`);
  const best = laps
    .filter((l) => !l.is_pit_out_lap && l.lap_duration && l.duration_sector_1 && l.duration_sector_2 && l.duration_sector_3)
    .sort((a, b) => a.lap_duration - b.lap_duration)[0];
  if (!best) throw new Error(`${name}: no complete lap with 3 sector times`);
  const start = new Date(best.date_start);
  const end = new Date(start.getTime() + best.lap_duration * 1000 + 300);
  const loc = await get(
    `/location?session_key=${session}&driver_number=${driver}&date%3E=${encodeURIComponent(start.toISOString())}&date%3C=${encodeURIComponent(end.toISOString())}`,
  );
  if (!Array.isArray(loc) || loc.length < 100) throw new Error(`${name}: too few location points (${loc?.length})`);
  loc.sort((a, b) => new Date(a.date) - new Date(b.date));
  // Keep every 2nd sample (~0.5 s, ~30 m): invisible on a 300 px map, halves the file.
  const kept = loc.filter((_, i) => i % 2 === 0);
  const t = kept.map((p) => (new Date(p.date) - start) / 1000);
  const s1 = best.duration_sector_1;
  const s2 = s1 + best.duration_sector_2;
  const s1End = t.findIndex((v) => v >= s1);
  const s2End = t.findIndex((v) => v >= s2);
  if (!(s1End > 0 && s2End > s1End && s2End < kept.length - 1)) throw new Error(`${name}: could not derive sector boundaries`);
  const pts = kept.map((p) => [Math.round(p.x), Math.round(p.y), Math.round(p.z)]);
  const zs = pts.map((p) => p[2]);
  const out = {
    circuitKey: Number(circuitKey),
    sourceSession: session,
    driver,
    lap: best.lap_number,
    lapTime: best.lap_duration,
    n: pts.length,
    s1End,
    s2End,
    pts,
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, `${circuitKey}.json`), JSON.stringify(out));
  console.log(`${name} (${circuitKey}): ${pts.length} pts, S1 ends ${s1End}, S2 ends ${s2End}, z ${Math.min(...zs)}..${Math.max(...zs)} dm`);
}

const want = process.argv.slice(2);
const keys = want.length ? want : Object.keys(SOURCES);
let failed = 0;
for (const k of keys) {
  if (!SOURCES[k]) {
    console.error(`unknown circuit key ${k}`);
    failed++;
    continue;
  }
  try {
    await build(k, SOURCES[k]);
  } catch (e) {
    failed++;
    console.error(`FAILED ${SOURCES[k].name}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
