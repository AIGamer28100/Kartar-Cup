import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { QUESTIONS } from '../../src/config/event';
import { BAD_PLAY_URL, PLAY_URL, hostLogin, SCREENS, resetAndSeed, saveResultsAdmin, setRaceTiming, setStatus } from './helpers';

async function serious(page: Page) {
  await page.waitForTimeout(3000);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
}

const PICKS = ['Williams', 'Norris', 'Stroll', 'Red Bull', 'Russell'];

async function signIn(page: Page, _name?: string) {
  // The hero CTA is the Google sign-in (popup); the emulator cannot pop Google, so sign in with the emulator credential.
  await expect(page.getByRole('button', { name: /get on the grid/i })).toBeVisible();
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0); // R14: no typed-name path
  await hostLogin(page, 'guest@example.com'); // emulator Google credential
  await expect(page.getByRole('button', { name: /get on the grid/i })).toHaveCount(0); // signed in: straight to the quiz or the lobby
}

async function answerByKeyboard(page: Page) {
  for (let i = 0; i < PICKS.length; i++) {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(QUESTIONS[i].prompt);
    const card = page.getByRole('radio', { name: PICKS[i] });
    await card.focus();
    await page.keyboard.press('Enter'); // pick; the quiz advances by itself
    await expect(card).toHaveAttribute('aria-checked', 'true');
    if (i === 1) await page.screenshot({ path: `${SCREENS}/guest-a3-open-quiz.png` });
  }
}

test.beforeEach(async () => {
  await resetAndSeed();
});

test('guest joins, answers by keyboard, sees confirmation, lock, then own score', async ({ page, browser }) => {
  await page.goto(PLAY_URL);
  await expect(page.getByText('Picks close in').first()).toBeVisible();
  expect(await serious(page)).toEqual([]);
  await page.screenshot({ path: `${SCREENS}/guest-hero.png` });

  await signIn(page, 'Ananya Ramesh');
  await page.screenshot({ path: `${SCREENS}/guest-signin.png` });

  await answerByKeyboard(page);
  await expect(page.getByRole('heading', { name: 'Your grid' })).toBeVisible();
  await page.getByRole('button', { name: 'Lock in my picks' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Picks locked in' })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/guest-confirmation.png`, fullPage: true });

  await setStatus('locked');
  await expect(page.getByRole('heading', { name: 'Pit lane closed' })).toBeVisible();
  await page.screenshot({ path: `${SCREENS}/guest-a3-closed.png`, fullPage: true });

  // A new guest arriving after the lock sees the locked state.
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const late = await ctx.newPage();
  await late.goto(PLAY_URL);
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
  await page.screenshot({ path: `${SCREENS}/guest-a3-own-score.png`, fullPage: true });
});

test('scheduled: countdown hero, early sign-in, quiz gated, then opens by itself', async ({ page }) => {
  await setRaceTiming(60);
  await page.goto(PLAY_URL);
  await expect(page.getByText(/Picks open 10 minutes before lights out/)).toBeVisible();
  await expect(page.getByText(/before the lights go out/i)).toHaveCount(0);
  expect(await serious(page)).toEqual([]);
  await page.screenshot({ path: `${SCREENS}/guest-a3-scheduled.png` });
  await signIn(page, 'Early Bird');
  await page.screenshot({ path: `${SCREENS}/guest-a3-waiting.png` });
  await expect(page.getByText(/first call appears here by itself/)).toBeVisible();
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
  await setRaceTiming(5);
  await expect(page.getByRole('radiogroup')).toBeVisible({ timeout: 8000 });
});

test('closed with no submission shows an honest empty state', async ({ page }) => {
  await setStatus('locked');
  await page.goto(PLAY_URL);
  await expect(page.getByRole('heading', { name: 'Pit lane closed' })).toBeVisible();
  await expect(page.getByText(/did not lock in any picks/)).toBeVisible();
});

test('the quiz is not public: a guest opening / does not see it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /get on the grid/i })).toHaveCount(0);
  await expect(page.getByText('Picks close in')).toHaveCount(0);
  await expect(page.getByRole('radiogroup')).toHaveCount(0);
});

test('a bad play token shows the not-active state and never the quiz', async ({ page }) => {
  await page.goto(BAD_PLAY_URL);
  await expect(page.getByRole('alert')).toContainText(/quiz link is not active/i);
  await expect(page.getByRole('button', { name: /get on the grid/i })).toHaveCount(0);
  await page.goto('/play/short'); // not even a well-formed token: rejected without reading Firestore
  await expect(page.getByRole('alert')).toContainText(/quiz link is not active/i);
});
