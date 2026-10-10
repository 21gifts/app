import { expect, test, type Page } from '@playwright/test';

/**
 * Error reporting in the Playwright build: `playwright.config.ts` sets
 * `NEXT_PUBLIC_SENTRY_DSN` empty, so every check here is the "off" state —
 * nothing starts, nothing is sent, and the tunnel is closed. The "on" state is
 * covered by the unit tests of `src/lib/sentry.ts` and the init files.
 */

/** Envelope header line naming some DSN, as the browser SDK posts it. */
const ENVELOPE = '{"dsn":"https://key@errors.example/1"}\n{"type":"event"}\n{}';

/**
 * Record every request the page sends to the error-report tunnel.
 *
 * @param page - Page under test.
 * @returns The recorded tunnel URLs (live array).
 */
function recordTunnelPosts(page: Page): string[] {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/monitoring') {
      posts.push(request.url());
    }
  });
  return posts;
}

/**
 * Open `/login`, throw an uncaught error in the page, and wait until the
 * network is quiet.
 *
 * @param page - Page under test.
 */
async function throwInPage(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await page.evaluate(() => {
    const error = new Error('e2e error abandon ability able about above absent absorb abstract');
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }));
  });
  await page.waitForLoadState('networkidle');
}

test('Function: sentryOptions — without a DSN an uncaught error sends no report', async ({
  page,
}) => {
  const posts = recordTunnelPosts(page);
  await throwInPage(page);
  expect(posts).toEqual([]);
});

test('Function: getSentryDsn — the empty DSN of the test build keeps the tunnel closed', async ({
  request,
}) => {
  const res = await request.post('/monitoring', { data: ENVELOPE });
  expect(res.status()).toBe(404);
});

test('Function: getSentryEnvironment — no environment and no DSN send no report', async ({
  page,
}) => {
  const posts = recordTunnelPosts(page);
  await throwInPage(page);
  await page.goto('/welcome');
  await page.waitForLoadState('networkidle');
  expect(posts).toEqual([]);
});

test('Function: forwardSentryEnvelope — POST /monitoring is 404 while reporting is off', async ({
  request,
}) => {
  const res = await request.post('/monitoring', {
    data: ENVELOPE,
    headers: { 'Content-Type': 'application/x-sentry-envelope' },
  });
  expect(res.status()).toBe(404);
  expect(await res.text()).toBe('');
});

test('Function: register — the server starts with error reporting off', async ({ request }) => {
  const health = await request.get('/healthz');
  expect(health.status()).toBe(200);
  expect((await request.post('/monitoring', { data: ENVELOPE })).status()).toBe(404);
});

test('Function: onRequestError — server pages render with the hook loaded and reporting off', async ({
  request,
}) => {
  const res = await request.get('/welcome');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('<html');
});

test('Function: GlobalError — a render error shows the global error page', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: null,
        role: 'founder',
        name: 'Ada',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        funding: { status: 'none', trialUtcDate: null, admittedAt: null, reviewedByName: null },
      }),
    });
  });
  // An applied time past the Date range makes the row throw while rendering.
  await page.route('**/funding/applications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        applications: [{ accountId: 'acc_rose', name: 'Rose', role: 'verified', appliedAt: 9e15 }],
      }),
    });
  });
  const posts = recordTunnelPosts(page);
  await page.goto('/grants/applications');
  await expect(
    page.getByText(/Application error: a client-side exception has occurred/),
  ).toBeVisible();
  // The built-in fallback renders `<html id="__next_error__">`; ours does not.
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html#__next_error__')).toHaveCount(0);
  expect(posts).toEqual([]);
});
