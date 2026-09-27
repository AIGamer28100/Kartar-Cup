import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { hostLogin, resetAndSeed, saveResultsAdmin } from './helpers';

test.beforeEach(async () => {
  await resetAndSeed();
});

async function serious(page: Page) {
  await page.waitForTimeout(900); // let entrance animations settle before measuring contrast
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ') + ' ' + (n.any[0]?.message ?? '')).join(' | ')}`);
}

test('guest sign-in and quiz have no serious violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /get on the grid/i })).toBeVisible();
  expect(await serious(page)).toEqual([]);

  await hostLogin(page, 'guest@example.com'); // emulator Google credential (R14)
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('combobox')).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

test('host leaderboard has no serious violations', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await saveResultsAdmin({ q1: ['williams'], q2: ['norris'], q3: ['stroll'], q4: ['red-bull'], q5: ['russell'] });
  await page.goto('/host');
  await hostLogin(page, 'host@example.com');
  await expect(page.getByRole('region', { name: 'Leaderboard' })).toContainText('Priya Venkatesh');
  expect(await serious(page)).toEqual([]);
  await ctx.close();
});
