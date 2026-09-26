import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { SCREENS, hostLogin, resetAndSeed } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetAndSeed();
  await page.goto('/host/settings');
  await hostLogin(page, 'host@example.com');
  await expect(page.getByRole('heading', { name: 'Event settings' })).toBeVisible();
  await expect(page.getByLabel('Event name')).not.toHaveValue('');
});

const shot = (page: Page, name: string) => page.screenshot({ path: `${SCREENS}/settings-${name}.png`, fullPage: true });

test('whatsapp link: invalid shows inline error, valid saves', async ({ page }) => {
  const wa = page.getByLabel('Community link');
  await wa.fill('http://evil.example/x');
  await expect(page.getByText(/Use https:\/\/chat\.whatsapp\.com/)).toBeVisible();
  await page.getByRole('button', { name: 'Save event' }).click();
  await expect(page.getByTestId('save-banner')).toContainText(/fix the highlighted/i);

  await wa.fill('https://chat.whatsapp.com/AbC123xyz');
  await expect(page.getByText(/Use https:\/\/chat\.whatsapp\.com/)).toHaveCount(0);
  const test = page.getByRole('link', { name: 'Test link' });
  await expect(test).toHaveAttribute('target', '_blank');
  await expect(test).toHaveAttribute('rel', /noopener/);
  await expect(page.getByTestId('dirty-indicator')).toContainText('Unsaved');
  await page.getByRole('button', { name: 'Save event' }).click();
  await expect(page.getByTestId('save-banner')).toContainText('Event saved');
  await expect(page.getByTestId('dirty-indicator')).toContainText('All changes saved');
  await page.reload();
  await hostLogin(page, 'host@example.com');
  await expect(page.getByLabel('Community link')).toHaveValue('https://chat.whatsapp.com/AbC123xyz');
});

test('pick a race then save and set live', async ({ page }) => {
  const picker = page.locator('#race-picker');
  const opt = picker.locator('option:not([disabled])').nth(3);
  const value = await opt.getAttribute('value');
  const before = await page.getByLabel('Event name').inputValue();
  await picker.selectOption(value!);
  await expect(page.getByLabel('Event name')).not.toHaveValue(before); // pickRace is async
  const name = await page.getByLabel('Event name').inputValue();
  await page.getByRole('button', { name: 'Set as live event' }).click();
  await expect(page.getByTestId('save-banner')).toContainText('live event');
  await expect(page.getByRole('region', { name: 'Live controls' })).toContainText(name);
});

test('extend closing by 10 minutes updates the close time', async ({ page }) => {
  const closes = page.getByTestId('live-closes');
  await expect(closes).toContainText('UTC');
  const minutes = async () => {
    const t = (await closes.innerText()).replace(/\s+/g, ' ');
    const m = /UTC.*?(\d\d):(\d\d)/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const before = await minutes();
  await page.getByRole('button', { name: /extend closing \+10/i }).click();
  await expect.poll(async () => ((await minutes()) - before + 1440) % 1440).toBe(10);
});

test('settings page has no serious a11y violations and screenshots', async ({ page }) => {
  await page.waitForTimeout(900);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const bad = r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
  expect(bad).toEqual([]);
  const w = page.viewportSize()?.width ?? 0;
  await shot(page, String(w));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot(page, '390');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
  await shot(page, '1440');
});
