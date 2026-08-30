import { defineConfig, devices } from '@playwright/test';

/** Desktop Chromium viewport for visual baselines. */
const DESKTOP_VIEWPORT = { width: 1280, height: 720 };

/** Phone viewport used for mobile visual baselines (matches prior 375×812 shots). */
const MOBILE_VIEWPORT = { width: 375, height: 812 };

/**
 * iPhone UA so mobile visual projects follow the smartphone pay-sheet rule
 * (`isSmartphoneUserAgent`: no payment QR).
 */
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const desktopChrome = devices['Desktop Chrome'];

/**
 * One visual-baseline Playwright project (Linux Chromium snapshots).
 *
 * @param id - Combo id (`desktop-light`, …).
 * @param theme - Forced `prefers-color-scheme`.
 * @param viewport - `desktop` or `mobile`.
 * @returns Project config.
 */
function visualProject(
  id: 'desktop-light' | 'desktop-dark' | 'mobile-light' | 'mobile-dark',
  theme: 'light' | 'dark',
  viewport: 'desktop' | 'mobile',
) {
  const mobile = viewport === 'mobile';
  return {
    name: id,
    testMatch: '**/visual.spec.ts',
    use: {
      ...desktopChrome,
      viewport: mobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT,
      colorScheme: theme,
      ...(mobile
        ? { isMobile: true, hasTouch: true, userAgent: IPHONE_UA }
        : { isMobile: false, hasTouch: false }),
    },
  };
}

/**
 * Playwright end-to-end configuration.
 *
 * Starts the local api protocol stub on :3001, then the standalone production
 * server (`node .next/standalone/server.js`, the Docker artifact) on :3000
 * with NEXT_PUBLIC_API_URL pointing at the stub. Locally an already-running
 * pair is reused; CI (`CI=1`) always builds and starts both processes fresh.
 *
 * Behavioral specs run once (`chromium`). Visual baselines run in four
 * projects: desktop/mobile × light/dark.
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
      testIgnore: '**/visual.spec.ts',
      use: { ...desktopChrome },
    },
    visualProject('desktop-light', 'light', 'desktop'),
    visualProject('desktop-dark', 'dark', 'desktop'),
    visualProject('mobile-light', 'light', 'mobile'),
    visualProject('mobile-dark', 'dark', 'mobile'),
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
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3001',
      },
    },
  ],
});
