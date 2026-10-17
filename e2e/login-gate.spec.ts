import { expect, test, type Page } from '@playwright/test';
import { installFakeWebAuthn } from './fake-webauthn';

// Every test in this file gets its own cap; the run has its global timeout.
test.describe.configure({ timeout: 60_000 });

const CLOSED_LINE = '21.gifts is updating. Please try again a little later.';
const OUTDATED_LINE = 'A new version is ready';

/**
 * Lets authenticate begin and the passkey prompt through, then answers
 * authenticate finish with the api's logins_closed refusal, as the api does
 * once it knows the account.
 */
async function closeLogins(page: Page): Promise<void> {
  await installFakeWebAuthn(page, true);
  await page.route(/\/auth\/passkey\/authenticate\/finish$/, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Logins are paused for an update. Try again later.',
        code: 'logins_closed',
      }),
    });
  });
}

/**
 * Sends authenticate begin with an old build id, through the app's own proxy
 * to the mock api, which refuses exactly that build as app_outdated.
 */
async function sendOldBuild(page: Page): Promise<void> {
  await page.route(/\/auth\/passkey\/authenticate\/begin$/, async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), 'x-app-build': 'e2e-old-build' },
    });
  });
}

test('login closed: the card shows the calm line and nothing to retry', async ({ page }) => {
  let finishes = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/auth/passkey/authenticate/finish')) {
      finishes += 1;
    }
  });
  await closeLogins(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('status').filter({ hasText: CLOSED_LINE })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Log in' })).toHaveCount(0);
  await page.waitForTimeout(1_500);
  expect(finishes).toBe(1);
});

test('login outdated: Reload loads the page again', async ({ page }) => {
  await sendOldBuild(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('status').filter({ hasText: OUTDATED_LINE })).toBeVisible();
  await page.unroute(/\/auth\/passkey\/authenticate\/begin$/);
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Reload' }).click(),
  ]);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByText(OUTDATED_LINE)).toHaveCount(0);
});

test('a wiped session falls back to signed out on the next load', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-wiped-seeded') === null) {
      sessionStorage.setItem('e2e-wiped-seeded', '1');
      localStorage.setItem('21gifts.session', 'sess-deleted-by-operator');
    }
  });
  const refused = page.waitForResponse(
    (response) =>
      /\/me$/.test(response.url()) &&
      response.request().headers()['authorization'] === 'Bearer sess-deleted-by-operator',
  );
  await page.goto('/login');
  expect((await refused).status()).toBe(401);
  await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  await expect(page.getByText(/Welcome back/)).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('21gifts.session'))).toBeNull();
});

test('Function: getBuildId — passkey begin sends the bundle build id', async ({ page }) => {
  const sent = page.waitForRequest((request) =>
    request.url().endsWith('/auth/passkey/authenticate/begin'),
  );
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  expect((await sent).headers()['x-app-build']).toBe('dev');
});

test('Function: LoginsClosedError — logins_closed shows the closed line', async ({ page }) => {
  await closeLogins(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText(CLOSED_LINE)).toBeVisible();
  await expect(page.getByText('Something went wrong. Please try again.')).toHaveCount(0);
});

test('Function: AppOutdatedError — the proxy passes an old build to the api', async ({
  page,
  request,
}) => {
  const direct = await request.post('/auth/passkey/authenticate/begin', {
    headers: { 'x-app-build': 'e2e-old-build' },
  });
  expect(direct.status()).toBe(403);
  expect(((await direct.json()) as { code: string }).code).toBe('app_outdated');
  await sendOldBuild(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText(OUTDATED_LINE)).toBeVisible();
});

test('Function: LoginBlockedNotice — outdated offers Reload, closed offers nothing', async ({
  page,
}) => {
  await sendOldBuild(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible();
  await page.unroute(/\/auth\/passkey\/authenticate\/begin$/);
  await closeLogins(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText(CLOSED_LINE)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0);
});
