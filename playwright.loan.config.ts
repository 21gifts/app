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

/** Zones spread across the date line, east first. */
const LOAN_ZONES = [
  'Pacific/Kiritimati',
  'Pacific/Auckland',
  'Asia/Tokyo',
  'Asia/Manila',
  'Europe/Berlin',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Pacific/Honolulu',
  'Pacific/Pago_Pago',
  'Etc/GMT+12',
];

/**
 * Sunday rest refuses the loan writes when the browser zone is Sunday.
 * Pick the candidate with the most time left before its local Sunday.
 */
function loanTimeZone(now = Date.now()): string {
  let best = 'UTC';
  let bestHours = -1;
  for (const zone of LOAN_ZONES) {
    let hours = 168;
    try {
      for (let hour = 0; hour < 168; hour += 1) {
        const day = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(
          now + hour * 60 * 60 * 1000,
        );
        if (day === 'Sun') {
          hours = hour;
          break;
        }
      }
    } catch {
      continue;
    }
    if (hours > bestHours) {
      best = zone;
      bestHours = hours;
    }
  }
  return best;
}

const loanZone = loanTimeZone();

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
    timezoneId: loanZone,
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
      TZ: loanZone,
    },
  },
});
