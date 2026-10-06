import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';

export const PROJECT = 'demo-kartar-cup';
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
