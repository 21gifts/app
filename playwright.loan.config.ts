import { defineConfig, devices } from '@playwright/test';

/**
 * Live loan screens. Not part of `npm run e2e`.
 *
 * The loan harness starts this config against the local api. The screens are
 * the ones on staging: the welcome composer, a gift on the note, repayment-due
 * bill creation, and the ledger on that note. The separate repayment-list
 * page is not on staging, so this test does not open it.
 */
const desktopChrome = devices['Desktop Chrome'];

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/loan-live.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  timeout: 6 * 60 * 60 * 1000,
  expect: { timeout: 60_000 },
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:3010',
    locale: 'en-US',
    timezoneId: 'UTC',
    extraHTTPHeaders: { 'Accept-Language': 'en' },
    screenshot: 'only-on-failure',
    trace: 'off',
    video: 'off',
    actionTimeout: 60_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...desktopChrome },
    },
  ],
  webServer: {
    command: 'npm run build && npm run start:standalone',
    url: 'http://127.0.0.1:3010/healthz',
    reuseExistingServer: false,
    timeout: 900_000,
    env: {
      ...process.env,
      PORT: '3010',
      HOSTNAME: '127.0.0.1',
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3000',
      NEXT_PUBLIC_APP_VERSION: 'dev',
      NEXT_PUBLIC_E2E_NOW: '2026-01-07T12:00:00.000Z',
      NEXT_PUBLIC_PLATFORM_USERNAME: '21gifts',
      NEXT_PUBLIC_SENTRY_DSN: '',
      NEXT_PUBLIC_SENTRY_ENVIRONMENT: '',
      TZ: 'UTC',
    },
  },
});
