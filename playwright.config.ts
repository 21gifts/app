import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright end-to-end configuration.
 *
 * Runs against the production build (`npm run build && npm run start`) so the
 * smoke tests exercise what actually ships. Locally an already-running server
 * on :3000 is reused; CI always builds and starts fresh.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3000/healthz',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
