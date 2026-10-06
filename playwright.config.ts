import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: 'line',
  outputDir: 'test-results/artifacts',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'off' },
  projects: [
    { name: 'guest', testMatch: /(guest|a11y)\.spec\.ts/, use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'host', testMatch: /(host|settings)\.spec\.ts/, use: { viewport: { width: 1440, height: 900 } } },
  ],
});
