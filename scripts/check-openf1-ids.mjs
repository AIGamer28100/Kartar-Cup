/**
 * Re-validates src/config/tracks/openf1Ids.ts against the live OpenF1 API.
 *
 *   npm run check:openf1
 *
 * For every season in the calendar it fetches /v1/meetings?year=YYYY, matches each calendar race to the
 * meeting whose dates fall inside the race weekend (dates are unambiguous where OpenF1's commercial
 * names are not, e.g. Malaysia is reported as "Bahrain"), and prints a table. Exits 1 if any race is:
 *   - unmapped (no entry in OPENF1_IDS),
 *   - mapped to a meeting whose dates fall outside its weekend,
 *   - mapped to a different meeting than the one the live API says is on that weekend.
 * Also flags OPENF1_IDS entries that are not in the calendar. Run it when the calendar changes.
 * Paced at ~2.5 req/s to stay inside OpenF1's free tier (3 req/s, 30 req/min).
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OPENF1 = 'https://api.openf1.org/v1';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 86_400_000;
const day = (iso) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);

// The calendar and mapping are TypeScript: bundle them in memory with esbuild (already a vite dependency).
async function loadSources() {
  const out = await build({
    stdin: {
      contents: "export { ALL_RACES } from './src/config/calendar/index'; export { OPENF1_IDS } from './src/config/tracks/openf1Ids';",
      resolveDir: ROOT,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    write: false,
    logLevel: 'silent',
  });
  const code = out.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

let lastReq = 0;
async function getJson(url) {
  const wait = lastReq + 420 - Date.now();
  if (wait > 0) await sleep(wait);
  lastReq = Date.now();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

const main = async () => {
  const { ALL_RACES, OPENF1_IDS } = await loadSources();
  const seasons = [...new Set(ALL_RACES.map((r) => r.season))].sort();
  const meetings = [];
  for (const y of seasons) {
    const rows = await getJson(`${OPENF1}/meetings?year=${y}`);
    if (!Array.isArray(rows)) throw new Error(`unexpected /meetings response for ${y}`);
    meetings.push(...rows);
  }
  const inWeekend = (m, race) => {
    const lo = day(race.weekendStart) - DAY;
    const hi = day(race.weekendEnd) + DAY;
    const s = day(m.date_start);
    const e = m.date_end ? day(m.date_end) : s;
    return s >= lo && e <= hi;
  };

  const problems = [];
  const rows = [];
  for (const race of ALL_RACES) {
    const mapped = OPENF1_IDS[race.id];
    const live = meetings.filter((m) => inWeekend(m, race));
    const liveMeeting = live.length === 1 ? live[0] : undefined;
    let status = 'ok';
    if (!mapped) {
      status = 'UNMAPPED';
    } else {
      const m = meetings.find((x) => x.meeting_key === mapped.meetingKey);
      if (!m) status = 'MEETING NOT IN API';
      else if (!inWeekend(m, race)) status = 'OUTSIDE WEEKEND';
      else if (liveMeeting && liveMeeting.meeting_key !== mapped.meetingKey) status = 'DISAGREES';
      else if (m.circuit_key !== undefined && m.circuit_key !== mapped.circuitKey) status = 'CIRCUIT MISMATCH';
    }
    if (status !== 'ok') problems.push(`${race.id}: ${status}`);
    const m = mapped && meetings.find((x) => x.meeting_key === mapped.meetingKey);
    rows.push([
      race.id.padEnd(26),
      `${race.weekendStart}..${race.weekendEnd}`,
      String(mapped?.meetingKey ?? '-').padStart(5),
      String(liveMeeting?.meeting_key ?? '-').padStart(5),
      m ? `${m.date_start.slice(0, 10)}..${(m.date_end ?? m.date_start).slice(0, 10)}` : '-'.padEnd(22),
      `${m?.country_name ?? '?'} / ${m?.location ?? '?'}`,
      status,
    ]);
  }
  console.log(['race'.padEnd(26), 'weekend'.padEnd(23), 'mapped', 'live', 'meeting dates'.padEnd(22), 'OpenF1 label', 'status'].join('  '));
  for (const r of rows) console.log(r.join('  '));

  const known = new Set(ALL_RACES.map((r) => r.id));
  for (const id of Object.keys(OPENF1_IDS)) if (!known.has(id)) problems.push(`${id}: in OPENF1_IDS but not in the calendar`);

  const mappedCount = ALL_RACES.filter((r) => OPENF1_IDS[r.id]).length;
  console.log(`\n${mappedCount}/${ALL_RACES.length} calendar races mapped, ${problems.length} problem(s).`);
  if (problems.length) {
    for (const p of problems) console.error(`  FAIL ${p}`);
    process.exit(1);
  }
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
