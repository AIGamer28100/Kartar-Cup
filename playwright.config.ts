import { defineConfig } from '@playwright/test';

// webServer starts the Auth + Firestore emulators and vite dev against them.
// Manual alternative: `npm run emu` in one terminal, `VITE_USE_EMULATORS=true npm run dev` in another.
// Tests reset and seed the emulator themselves (tests/e2e/helpers.ts).
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
  webServer: [
    {
      command: 'npx firebase emulators:start --only auth,firestore --project demo-kartar-cup',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      command: 'VITE_USE_EMULATORS=true VITE_FIREBASE_API_KEY=demo-key VITE_FIREBASE_PROJECT_ID=demo-kartar-cup npx vite --host 127.0.0.1 --port 5173 --strictPort',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
