import { expect, test, type Page } from '@playwright/test';
import { QUESTIONS } from '../../src/config/event';
import { SCREENS, resetAndSeed, saveResultsAdmin, setStatus } from './helpers';

const PICKS = ['Williams', 'Norris', 'Stroll', 'Red Bull', 'Russell'];

async function signIn(page: Page, name: string) {
  await page.getByRole('button', { name: /get on the grid/i }).click();
  await page.getByLabel('Name', { exact: true }).fill(name);
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
    if (i === 1) await page.screenshot({ path: `${SCREENS}/guest-quiz-mid.png` });
    await page.keyboard.press('Enter'); // next
  }
}

test.beforeEach(async () => {
  await resetAndSeed();
});

test('guest joins, answers by keyboard, sees confirmation, lock, then own score', async ({ page, browser }) => {
  await page.goto('/');
  await expect(page.getByText('Lights out in')).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/guest-hero.png` });

  await signIn(page, 'Ananya Ramesh');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SCREENS}/guest-signin.png` });
  await page.getByRole('button', { name: 'Join with this name' }).click();

  await answerByKeyboard(page);
  await expect(page.getByRole('heading', { name: 'Ready to commit?' })).toBeVisible();
  await page.getByRole('button', { name: 'Lock in my picks' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Picks locked in' })).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SCREENS}/guest-confirmation.png`, fullPage: true });

  await setStatus('locked');
  await expect(page.getByRole('heading', { name: 'Picks are locked' })).toBeVisible();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SCREENS}/guest-locked.png`, fullPage: true });

  // A new guest arriving after the lock sees the locked state.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const late = await ctx.newPage();
  await late.goto('/');
  await expect(late.getByRole('heading', { name: 'Picks are locked' })).toBeVisible();
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
  await page.screenshot({ path: `${SCREENS}/guest-own-score.png`, fullPage: true });
});
