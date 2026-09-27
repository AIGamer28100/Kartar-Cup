import { expect, test } from '@playwright/test';
import { SCREENS, hostLogin, resetAndSeed } from './helpers';

test.beforeEach(async () => {
  await resetAndSeed();
});

test('gate rejects non-host, host runs the whole night', async ({ page }) => {
  await page.goto('/host');
  await expect(page).toHaveURL(/\/$/); // R18: no host login UI, unauthenticated /host bounces home

  await hostLogin(page, 'host@example.com');
  await page.getByRole('link', { name: 'Host console' }).click();
  await expect(page.getByRole('region', { name: 'Race control' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Race control' }).locator('[aria-live]')).toHaveText('3');
  await expect(page.getByText('Karthik Subramanian')).toBeVisible();

  await page.getByRole('button', { name: /lock the pit lane/i }).click();
  await expect(page.getByRole('button', { name: /reopen entries/i })).toBeVisible();

  const results = page.getByRole('region', { name: 'Results' });
  const set: [string, string][] = [
    ['Which constructor has the SLOWEST', 'Williams'],
    ['Which driver makes the MOST', 'Norris'],
    ['Which driver will DNF', 'Stroll'],
    ['Which constructor has the FASTEST', 'Red Bull'],
    ['Which driver sets the FASTEST LAP', 'Russell'],
  ];
  for (const [prompt, label] of set) {
    await results
      .locator('fieldset', { hasText: prompt })
      .getByRole('button', { name: label, exact: true })
      .click();
  }
  await page.getByRole('button', { name: /save results/i }).click();
  await expect(page.getByText(/results saved/i)).toBeVisible();

  const board = page.getByRole('region', { name: 'Leaderboard' });
  const first = board.locator('li').first();
  await expect(first).toContainText('Priya Venkatesh');
  await expect(first).toContainText('5');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SCREENS}/host-console.png` });
  await board.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SCREENS}/host-leaderboard.png` });

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /export entries csv/i }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);

  await page.getByRole('button', { name: /reveal the winner/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Winner' });
  await expect(dialog.getByText('Priya Venkatesh')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SCREENS}/host-reveal.png` });
});
