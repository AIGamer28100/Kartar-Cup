import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { QUESTIONS } from '../../src/config/event';
import { EVENT_ID, PROJECT, hostLogin, SCREENS, resetAndSeed, saveResultsAdmin, setStatus } from './helpers';

/** Move the seeded window through the emulator REST API (admin bearer). */
async function setWindow(opensInMin: number, closesInMin: number): Promise<void> {
  const ts = (m: number) => ({ timestampValue: new Date(Date.now() + m * 60_000).toISOString() });
  const q = 'updateMask.fieldPaths=opensAt&updateMask.fieldPaths=closesAt&updateMask.fieldPaths=raceStartUtc';
  const res = await fetch(
    `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/events/${EVENT_ID}?${q}`,
    {
      method: 'PATCH',
      headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { opensAt: ts(opensInMin), closesAt: ts(closesInMin), raceStartUtc: ts(opensInMin) } }),
    },
  );
  if (!res.ok) throw new Error(`setWindow ${res.status}`);
}

async function serious(page: Page) {
  await page.waitForTimeout(3000);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

const PICKS = ['Williams', 'Norris', 'Stroll', 'Red Bull', 'Russell'];

async function signIn(page: Page, _name?: string) {
  await page.getByRole('button', { name: /get on the grid/i }).click();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0); // R14: no typed-name path
  await hostLogin(page, 'guest@example.com'); // emulator Google credential
  await expect(page.getByText('Not you? Switch account')).toBeVisible();
}

async function answerByKeyboard(page: Page) {
  for (let i = 0; i < PICKS.length; i++) {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(QUESTIONS[i].prompt);
    const box = page.getByRole('combobox');
    await box.focus();
    await box.pressSequentially(PICKS[i]);
    await page.keyboard.press('Enter'); // select
    await expect(page.getByRole('option', { selected: true })).toContainText(PICKS[i]);
    if (i === 1) await page.waitForTimeout(500);
    if (i === 1) await page.screenshot({ path: `${SCREENS}/guest-a3-open-quiz.png` });
    await page.keyboard.press('Enter'); // next
  }
}

test.beforeEach(async () => {
  await resetAndSeed();
});

test('guest joins, answers by keyboard, sees confirmation, lock, then own score', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page.getByText('Picks close in').first()).toBeVisible();
  expect(await serious(page)).toEqual([]);
  await page.screenshot({ path: `${SCREENS}/guest-hero.png` });

  await signIn(page, 'Ananya Ramesh');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SCREENS}/guest-signin.png` });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await answerByKeyboard(page);
  await expect(page.getByRole('heading', { name: 'Ready to commit?' })).toBeVisible();
  await page.getByRole('button', { name: 'Lock in my picks' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Picks locked in' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SCREENS}/guest-confirmation.png`, fullPage: true });

  await setStatus('locked');
  await expect(page.getByRole('heading', { name: 'Pit lane closed' })).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SCREENS}/guest-a3-closed.png`, fullPage: true });

  // A new guest arriving after the lock sees the locked state.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const late = await ctx.newPage();
  await late.goto('/');
  await expect(late.getByRole('heading', { name: 'Pit lane closed' })).toBeVisible();
  await ctx.close();

  await saveResultsAdmin({
    q1: ['williams'],
    q2: ['norris'],
    q3: ['stroll'],
    q4: ['red-bull'],
    q5: ['russell'],
  });
  await setStatus('scored');
  await expect(page.getByRole('heading', { name: /your result/i })).toBeVisible();
  await expect(page.getByText('/ 5')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SCREENS}/guest-a3-own-score.png`, fullPage: true });
});

test('scheduled: countdown hero, early sign-in, quiz gated, then opens by itself', async ({ page }) => {
  await setWindow(60, 150);
  await page.goto('/');
  await expect(page.getByText(/Picks open at lights-out/)).toBeVisible();
  await expect(page.getByText(/before the lights go out/i)).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
  await page.screenshot({ path: `${SCREENS}/guest-a3-scheduled.png` });
  await signIn(page, 'Early Bird');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SCREENS}/guest-a3-waiting.png` });
  await expect(page.getByText(/quiz unlocks by itself/)).toBeVisible();
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await setWindow(-1, 80);
  await expect(page.getByRole('combobox')).toBeVisible({ timeout: 8000 });
});

test('closed with no submission shows an honest empty state', async ({ page }) => {
  await setStatus('locked');
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pit lane closed' })).toBeVisible();
  await expect(page.getByText(/did not radio in any picks/)).toBeVisible();
});
