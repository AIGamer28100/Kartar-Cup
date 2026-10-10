import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { BOOKING_ID, PLAY_URL, SCREENS, hostLogin, resetAndSeed, setRaceTiming } from './helpers';

/** The quiz editor is per booking event (R57): /host/bookings/:eventId/quiz/{details,grid,teams,questions}. */
const QUIZ = `/host/bookings/${BOOKING_ID}/quiz`;

test.beforeEach(async ({ page }) => {
  await resetAndSeed();
  await page.goto('/');
  await hostLogin(page, 'host@example.com'); // must be signed in before entering /host* (R18 bounces signed-out visitors home)
  await page.goto(`${QUIZ}/details`);
  await expect(page.getByRole('heading', { name: 'Quiz', exact: true })).toBeVisible();
  await expect(page.getByLabel('Event name')).not.toHaveValue('');
});

const shot = (page: Page, name: string) => page.screenshot({ path: `${SCREENS}/settings-${name}.png`, fullPage: true });

test('old /host/settings redirects to the bookings list', async ({ page }) => {
  await page.goto('/host/settings/grid');
  await expect(page).toHaveURL(/\/host\/bookings$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Event settings' })).toHaveCount(0);
});

test('whatsapp link: invalid shows inline error, valid saves', async ({ page }) => {
  const wa = page.getByLabel('Community link');
  await wa.fill('http://evil.example/x');
  await expect(page.getByText(/Use https:\/\/chat\.whatsapp\.com/)).toBeVisible();
  await page.getByRole('button', { name: 'Save quiz' }).click();
  await expect(page.getByTestId('save-banner')).toContainText(/fix the highlighted/i);

  await wa.fill('https://chat.whatsapp.com/AbC123xyz');
  await expect(page.getByText(/Use https:\/\/chat\.whatsapp\.com/)).toHaveCount(0);
  const test = page.getByRole('link', { name: 'Test link' });
  await expect(test).toHaveAttribute('target', '_blank');
  await expect(test).toHaveAttribute('rel', /noopener/);
  await expect(page.getByTestId('dirty-indicator')).toContainText('Unsaved');
  await page.getByRole('button', { name: 'Save quiz' }).click();
  await expect(page.getByTestId('save-banner')).toContainText('Quiz saved');
  await expect(page.getByTestId('dirty-indicator')).toContainText('All changes saved');
  await page.reload(); // persisted emulator session should restore without a fresh __e2eLogin call
  await expect(page.getByRole('heading', { name: 'Quiz', exact: true })).toBeVisible();
  await expect(page.getByLabel('Community link')).toHaveValue('https://chat.whatsapp.com/AbC123xyz');
});

test('quiz window is pinned to the lap rules: 10 min before lights out to the 30% cap', async ({ page }) => {
  // Seed: lights out in 5 min, 90 min race -> opens now-5 min .. closes at lights out + 27 min.
  await expect(page.getByTestId('quiz-window-summary')).toBeVisible();
  const closeEarlier = page.getByLabel('Close earlier (optional)');
  const openEarlier = page.getByLabel('Open later (optional)');
  await expect(closeEarlier).toHaveValue('');
  await expect(openEarlier).toHaveValue('');
  // A host can never close later than the cap: a later time is pulled back and the page says why.
  const pad = (n: number) => String(n).padStart(2, '0');
  const later = new Date(Date.now() + 3 * 3_600_000);
  await closeEarlier.fill(`${later.getFullYear()}-${pad(later.getMonth() + 1)}-${pad(later.getDate())}T${pad(later.getHours())}:${pad(later.getMinutes())}`);
  await expect(page.getByTestId('window-notes')).toContainText('must close before 30% of the race');
  // Opening earlier than 10 min before lights out is pulled back too.
  await closeEarlier.fill('');
  const earlier = new Date(Date.now() - 3 * 3_600_000);
  await openEarlier.fill(`${earlier.getFullYear()}-${pad(earlier.getMonth() + 1)}-${pad(earlier.getDate())}T${pad(earlier.getHours())}:${pad(earlier.getMinutes())}`);
  await expect(page.getByTestId('window-notes')).toContainText('cannot open earlier than 10 minutes before lights out');
});

test('pick a race then save and make it the live quiz', async ({ page }) => {
  const picker = page.locator('#race-picker');
  const opt = picker.locator('option:not([disabled])').nth(3);
  const value = await opt.getAttribute('value');
  const before = await page.getByLabel('Event name').inputValue();
  await picker.selectOption(value!);
  await expect(page.getByLabel('Event name')).not.toHaveValue(before, { timeout: 20_000 }); // pickRace is async (fetches the grid)
  const name = await page.getByLabel('Event name').inputValue();
  await page.getByRole('button', { name: 'Make this the live quiz' }).click();
  await expect(page.getByTestId('save-banner')).toContainText('live quiz');
  await page.goto('/host');
  await expect(page.getByRole('region', { name: 'Live controls' })).toContainText(name);
  // The pointer keeps its manual mode (settings/active = {eventId, mode}).
  await expect(page.getByRole('button', { name: 'Manual' })).toHaveAttribute('aria-pressed', 'true');
});

test('extend closing: capped at 30% by default, works once the close time is shortened', async ({ page }) => {
  await page.goto('/host');
  const live = page.getByRole('region', { name: 'Live controls' });
  const closes = live.getByTestId('live-closes');
  await expect(closes).toContainText('UTC');
  // Default window already closes at the 30% cap: nothing to extend, and the page says so.
  await expect(live.getByTestId('extend-room')).toHaveText(/already at 30% of the race/);
  await expect(live.getByRole('button', { name: /extend closing/i })).toHaveCount(0);

  // Host shortens the close by 30 min -> the control has room again.
  await setRaceTiming(5, { closeEarlyMin: 30 });
  await expect(live.getByTestId('extend-room')).toContainText('30 min later at most');
  const minutes = async () => {
    const t = (await closes.innerText()).replace(/\s+/g, ' ');
    const m = /UTC.*?(\d\d):(\d\d)/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const before = await minutes();
  await live.getByRole('button', { name: /extend closing \+10/i }).click();
  await expect.poll(async () => ((await minutes()) - before + 1440) % 1440).toBe(10);
  await expect(live.getByTestId('extend-room')).toContainText('20 min later at most');
});

test('typing the leader lap past 30% closes the quiz by lap', async ({ page }) => {
  await page.goto('/host');
  const live = page.getByRole('region', { name: 'Live controls' });
  await expect(live.getByTestId('clock-close-lap')).toHaveText('15'); // floor(30% of 50 laps)
  await expect(live.getByTestId('live-status')).toHaveText('Open');
  await live.getByLabel('Set lap').fill('15');
  await live.getByRole('button', { name: 'Set', exact: true }).click();
  await expect(live.getByTestId('live-status')).toHaveText('Closed');
  await expect(live.getByText('(closed by lap)')).toBeVisible();
});

test('quiz link: host revokes the shared link and creates a new one that works', async ({ page, browser }) => {
  const link = page.getByRole('region', { name: 'Quiz link' });
  const url = link.getByRole('textbox', { name: 'Quiz link' });
  await expect(url).toHaveValue(new RegExp(`${PLAY_URL}$`)); // the seeded link
  page.once('dialog', (d) => void d.accept());
  await link.getByRole('button', { name: /revoke/i }).click();
  await expect(link.getByRole('button', { name: 'Create quiz link' })).toBeVisible();

  const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const old = await guest.newPage();
  await old.goto(PLAY_URL);
  await expect(old.getByRole('alert')).toContainText(/quiz link is not active/i);

  await link.getByRole('button', { name: 'Create quiz link' }).click();
  await expect(url).toHaveValue(/\/play\/[A-Za-z0-9]{24}$/);
  const fresh = new URL(await url.inputValue()).pathname;
  expect(fresh).not.toBe(PLAY_URL);
  await old.goto(fresh);
  await expect(old.getByRole('button', { name: /get on the grid/i })).toBeVisible();
  await guest.close();
});

test('editors are tabbed, route-backed, and the unsaved indicator survives a tab switch (R22)', async ({ page }) => {
  const tabs = page.getByRole('navigation', { name: 'Quiz sections' });
  await expect(tabs).toBeVisible();
  const tab = (n: string) => tabs.getByRole('link', { name: n, exact: true });
  await expect(tab('Details')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Event name')).toBeVisible();

  await page.getByLabel('Event name').fill('Edited name');
  await expect(page.getByTestId('dirty-indicator')).toContainText('Unsaved');

  await tab('Grid').click();
  await expect(page).toHaveURL(new RegExp(`${QUIZ}/grid$`));
  await expect(tab('Grid')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { name: 'Starting grid' })).toBeVisible();
  await expect(page.getByTestId('dirty-indicator')).toContainText('Unsaved');

  await tab('Teams').click();
  await expect(page.getByRole('heading', { name: 'Teams', exact: true })).toBeVisible();

  await tab('Questions').click();
  await expect(page.getByRole('button', { name: /Add question/ })).toBeVisible();
  await expect(page.getByLabel('Event name')).toHaveCount(0); // Details fields are unmounted while another tab is active

  await tab('Details').click();
  await expect(page.getByLabel('Event name')).toHaveValue('Edited name');

  await tab('Results').click(); // sibling route, outside the form layout
  await expect(page).toHaveURL(new RegExp(`${QUIZ}/results$`));
  await expect(page.getByRole('region', { name: 'Results' })).toBeVisible();
});

test('quiz editor has no serious a11y violations and screenshots', async ({ page }) => {
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
