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
    raceStartUtc: at(60),
    raceDurationMin: 90,
    opensAt: at(-60),
    closesAt: at(120),
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
  await adminSet('settings/active', { eventId: EVENT_ID });
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
      uid, name, email, provider: 'google', answers: picks(labels), submittedAt: at(-30 + i), createdAt: at(-30 + i),
    });
  }
  await adminSet('hosts/host@example.com', { role: 'host' });
}
