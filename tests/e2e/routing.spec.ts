import { expect, test } from '@playwright/test';
import { hostLogin, resetAndSeed } from './helpers';

test.beforeEach(async () => {
  await resetAndSeed();
});

test('unknown path shows Invalid path with the attempted path', async ({ page }) => {
  await page.goto('/nope/not-here');
  await expect(page.getByRole('heading', { name: 'Invalid path' })).toBeVisible();
  await expect(page.getByTestId('attempted-path')).toHaveText('/nope/not-here');
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('/login is not a route', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Invalid path' })).toBeVisible();
});

test('guest visiting /host is redirected to /', async ({ page }) => {
  await page.goto('/');
  await hostLogin(page, 'guest@example.com');
  await page.goto('/host');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('pit wall')).toHaveCount(0);
});

test('guest visiting /host/settings is redirected to /', async ({ page }) => {
  await page.goto('/');
  await hostLogin(page, 'guest@example.com');
  await page.goto('/host/settings');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Event settings' })).toHaveCount(0);
});

test('signed-out /host is redirected to / with no host UI', async ({ page }) => {
  await page.goto('/host');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
  await expect(page.getByText('pit wall')).toHaveCount(0);
});

test('host sees the Host console link and can open /host; guest never sees it', async ({ page }) => {
  await page.goto('/');
  await hostLogin(page, 'guest@example.com');
  await expect(page.getByRole('link', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Host console' })).toHaveCount(0);
  await hostLogin(page, 'host@example.com');
  await page.getByRole('link', { name: 'Host console' }).click();
  await expect(page).toHaveURL(/\/host$/);
  await expect(page.getByRole('region', { name: 'Race control' })).toBeVisible();
});

test('/logout signs out and redirects home', async ({ page }) => {
  await page.goto('/');
  await hostLogin(page, 'guest@example.com');
  await expect(page.getByRole('link', { name: 'Sign out' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/logout$/);
  await expect(page.getByRole('heading', { name: 'You are signed out' })).toBeVisible();
  await expect(page.getByTestId('logout-countdown')).toBeVisible();
  await expect(page).toHaveURL(/\/$/, { timeout: 9000 });
  await expect(page.getByRole('button', { name: /get on the grid/i })).toBeVisible();
});

test('Back to home on /logout cancels the wait', async ({ page }) => {
  await page.goto('/logout');
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page).toHaveURL(/\/$/);
});
