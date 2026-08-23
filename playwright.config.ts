import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright end-to-end configuration.
 *
 * Starts the local api protocol stub on :3001, then the standalone production
 * server (`node .next/standalone/server.js`, the Docker artifact) on :3000
 * with NEXT_PUBLIC_API_URL pointing at the stub. Locally an already-running
 * pair is reused; CI always builds and starts fresh.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'en-US',
    extraHTTPHeaders: { 'Accept-Language': 'en' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node e2e/mock-api.mjs',
      url: 'http://127.0.0.1:3001/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npm run start:standalone',
      url: 'http://localhost:3000/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 360_000,
      env: {
        ...process.env,
        HOSTNAME: '0.0.0.0',
        // Local protocol stub so same-origin proxies succeed. Browser specs
        // may still intercept `/auth/lnurl` for isolated UI states.
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001',
      },
    },
  ],
});
