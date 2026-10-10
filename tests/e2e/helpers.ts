import type { Page } from '@playwright/test';
import { DRIVERS, QUESTIONS, TEAMS } from '../../src/config/event';

export const PROJECT = 'demo-kartar';
const FS = `http://127.0.0.1:8080`;
const AUTH = `http://127.0.0.1:9099`;
export const SCREENS = 'test-results/screens';

/** Wipe both emulators for a clean test state. */
export async function resetEmulators(): Promise<void> {
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
}

async function adminPatch(path: string, fields: Record<string, unknown>, mask: string[]): Promise<void> {
  const q = mask.map((m) => `updateMask.fieldPaths=${m}`).join('&');
  const res = await fetch(`${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}?${q}`, {
    method: 'PATCH',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

export const EVENT_ID = 'test-event';
/** The booking (watch party) event that owns the seeded quiz: its quiz editor lives at /host/bookings/BOOKING_ID/quiz/*. */
export const BOOKING_ID = 'be-quiz';
/** The seeded `playLinks` token that opens EVENT_ID (24 base62 chars). Guests play at /play/PLAY_TOKEN. */
export const PLAY_TOKEN = 'e2eQuizToken01234567890A';
export const PLAY_URL = `/play/${PLAY_TOKEN}`;
export const BAD_PLAY_URL = '/play/AAAAAAAAAAAAAAAAAAAAAAAA'; // well formed, but no such playLinks doc

/** 'locked' = manual override closed, 'open' = back to the auto window, 'scored' = winner revealed. */
export const setStatus = (status: 'open' | 'locked' | 'scored') =>
  status === 'scored'
    ? adminPatch(`events/${EVENT_ID}`, { winnerRevealed: { booleanValue: true } }, ['winnerRevealed'])
    : adminPatch(`events/${EVENT_ID}`, { override: { stringValue: status === 'locked' ? 'closed' : 'none' } }, ['override']);

export async function saveResultsAdmin(answers: Record<string, string[]>): Promise<void> {
  const fields = Object.fromEntries(
    Object.entries(answers).map(([k, v]) => [
      k,
      { arrayValue: { values: v.map((stringValue) => ({ stringValue })) } },
    ]),
  );
  await adminPatch(
    `events/${EVENT_ID}/results/answers`,
    {
      answers: { mapValue: { fields } },
      source: { stringValue: 'e2e' },
      updatedAt: { timestampValue: new Date().toISOString() },
    },
    ['answers', 'source', 'updatedAt'],
  );
}

export async function hostLogin(page: Page, email: string): Promise<void> {
  await page.waitForFunction(() => typeof window.__e2eLogin === 'function');
  await page.evaluate((e) => window.__e2eLogin!(e), email);
}

/* ---------- seed ---------- */

type FsValue = Record<string, unknown>;
/** Plain JS -> Firestore REST typed value. Dates become timestamps. */
function fsValue(v: unknown): FsValue {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, fsValue(x)])) } };
}
const fsFields = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, fsValue(v)]));

async function adminSet(path: string, data: Record<string, unknown>): Promise<void> {
  await adminPatch(path, fsFields(data), Object.keys(data));
}

/** A booking (watch party) event. `quizEventId` links it to a quiz so the per-event quiz routes use that quiz. */
export async function seedBookingEvent(id: string, title: string, opts: { tiers?: number; quizEventId?: string } = {}): Promise<void> {
  await adminSet(`bookingEvents/${id}`, {
    title,
    dateUtc: '2026-10-11T12:30:00.000Z',
    dateMs: Date.UTC(2026, 9, 11, 12, 30),
    capacity: 120,
    bookedCount: 55,
    salesOpen: true,
    hosted: true,
    category: 'f1',
    raceId: '2026-r17-singapore',
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    venue: { id: 'v1', name: 'Phoenix MarketCity, Velachery', city: 'Chennai' },
    discounts: [],
    tiers: Array.from({ length: opts.tiers ?? 2 }, (_, n) => ({ id: `t${n}`, label: `Tier ${n + 1} entry pass`, priceInr: 599 + n * 100 })),
    ...(opts.quizEventId ? { quizEventId: opts.quizEventId } : {}),
  });
}

/** Move the quiz window inside the allowed bounds: lights out in `startInMin`, opens 10 min before it (the
 * earliest allowed), closes at the 30% cap unless `closeEarlyMin` pulls it earlier. */
export async function setRaceTiming(startInMin: number, opts: { closeEarlyMin?: number } = {}): Promise<void> {
  const start = Date.now() + startInMin * 60_000;
  const cap = start + Math.floor(RACE_MIN * 18) * 1000;
  await adminSet(`events/${EVENT_ID}`, {
    raceStartUtc: new Date(start),
    opensAt: new Date(start - 10 * 60_000),
    closesAt: new Date(cap - (opts.closeEarlyMin ?? 0) * 60_000),
  });
}
const RACE_MIN = 90;

/** Wipe both emulators, then seed the live event the specs run against (`events/test-event`, open
 * window, the default questions/teams/drivers), make it the active event and add the host account
 * `host@example.com` (the console super admin: hosts/{lowercase-email}). */
export async function resetAndSeed(): Promise<void> {
  await resetEmulators();
  const now = Date.now();
  const at = (minutes: number) => new Date(now + minutes * 60_000);
  await adminSet(`events/${EVENT_ID}`, {
    id: EVENT_ID,
    raceId: 'custom',
    name: 'Test Grand Prix',
    subtitle: 'End-to-end test event',
    circuit: null,
    themeId: 'default',
    // Lap-based window: opens 10 min before lights out (earliest allowed), closes at the 30% cap
    // (18 s per race minute after lights out). Lights out is in 5 min, so the quiz is open right now.
    raceStartUtc: at(5),
    raceDurationMin: RACE_MIN,
    totalLaps: 50,
    opensAt: at(-5),
    closesAt: new Date(now + 5 * 60_000 + Math.floor(RACE_MIN * 18) * 1000),
    override: 'none',
    whatsappUrl: '',
    teams: TEAMS.map((t) => ({ id: t.id, label: t.label })),
    drivers: DRIVERS.map((d, i) => {
      const teamLabel = (d.sub ?? '').split(' · ')[0];
      return { id: d.id, label: d.label, teamId: TEAMS.find((t) => t.label === teamLabel)?.id ?? '', grid: i + 1 };
    }),
    questions: QUESTIONS.map((q) => ({ ...q })),
    questionIds: QUESTIONS.map((q) => q.id),
    winnerRevealed: false,
    tiebreakOverride: null,
    createdAt: at(0),
    updatedAt: at(0),
  });
  await adminSet('settings/active', { eventId: EVENT_ID, mode: 'manual' });
  await adminSet(`playLinks/${PLAY_TOKEN}`, { eventId: EVENT_ID, revoked: false, createdAt: at(-60), createdBy: 'host@example.com' });
  await seedBookingEvent(BOOKING_ID, 'Test Grand Prix watch party', { quizEventId: EVENT_ID });
  // Three guests: Priya picks the winning answers used by host.spec (Williams, Norris, Stroll,
  // Red Bull, Russell), the others get fewer right so the leaderboard has an order.
  const id = (list: { id: string; label: string }[], label: string) => list.find((o) => o.label === label)?.id ?? label;
  const picks = (labels: [string, string, string, string, string]) => ({
    q1: id(TEAMS, labels[0]), q2: id(DRIVERS, labels[1]), q3: id(DRIVERS, labels[2]), q4: id(TEAMS, labels[3]), q5: id(DRIVERS, labels[4]),
  });
  const guests: [string, string, [string, string, string, string, string]][] = [
    ['Priya Venkatesh', 'priya@example.com', ['Williams', 'Norris', 'Stroll', 'Red Bull', 'Russell']],
    ['Karthik Subramanian', 'karthik@example.com', ['Williams', 'Norris', 'Alonso', 'Mercedes', 'Leclerc']],
    ['Meena Raghavan', 'meena@example.com', ['Ferrari', 'Verstappen', 'Albon', 'Haas', 'Hamilton']],
  ];
  for (const [i, [name, email, labels]] of guests.entries()) {
    const uid = `guest-${i + 1}`;
    await adminSet(`events/${EVENT_ID}/entries/${uid}`, {
      uid, name, email, provider: 'google', answers: picks(labels), accessToken: PLAY_TOKEN, submittedAt: at(-30 + i), createdAt: at(-30 + i),
    });
  }
  await adminSet('hosts/host@example.com', { role: 'host' });
}
