import { expect, test, type Page } from '@playwright/test';

const LNURL = 'lnurl1dp68gurn8ghj7example';

/** Fulfills LUD-04 start + pending session poll so the QR view can render. */
async function mockPendingAuth(page: Page): Promise<void> {
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lnurl: LNURL,
        k1: 'ab'.repeat(32),
        pollToken: 'cd'.repeat(32),
        expiresInSeconds: 90,
      }),
    });
  });
  await page.route(/\/auth\/session$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'pending' }),
    });
  });
}

test('login page renders the wallet sign-in action', async ({ page }) => {
  await page.goto('/login');
  await expect(
    page.getByRole('button', { name: 'Log in with your Lightning wallet' }),
  ).toBeVisible();
});

test('Wallet of Satoshi login opens via custom scheme; copy is secondary', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockPendingAuth(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();

  await expect(page.getByRole('img', { name: 'Lightning login QR code' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    `walletofsatoshi:lightning:${LNURL.toUpperCase()}`,
  );
  await expect(page.getByRole('link', { name: 'Open default Lightning wallet' })).toHaveAttribute(
    'href',
    `lightning:${LNURL.toUpperCase()}`,
  );
  await expect(page.getByRole('button', { name: /copy for wallet of satoshi/i })).toHaveCount(0);

  await page.getByRole('button', { name: 'Copy login code' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe(LNURL);
});

test('Android login pins Wallet of Satoshi via intent package', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36',
      configurable: true,
    });
  });
  await mockPendingAuth(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByRole('link', { name: 'Open Wallet of Satoshi' })).toHaveAttribute(
    'href',
    `intent:lightning:${LNURL.toUpperCase()}#Intent;scheme=walletofsatoshi;package=com.livingroomofsatoshi.wallet;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.livingroomofsatoshi.wallet;end`,
  );
});

test('login shows Preparing your login while the challenge request hangs', async ({ page }) => {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await held;
    await route.abort();
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByText('Preparing your login…')).toBeVisible();
  release();
});

test('login shows Login expired when the session poll expires', async ({ page }) => {
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lnurl: LNURL,
        k1: 'ab'.repeat(32),
        pollToken: 'cd'.repeat(32),
        expiresInSeconds: 90,
      }),
    });
  });
  await page.route(/\/auth\/session$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'expired' }),
    });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByText('Login expired')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('login shows an error when the LNURL challenge cannot start', async ({ page }) => {
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
});

const E2E_ACCOUNT = {
  id: 'acc_e2e',
  linkingKey: `02${'a'.repeat(62)}`,
  role: 'basis' as const,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

test('login poll completes into the signed-in view', async ({ page }) => {
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        lnurl: LNURL,
        k1: 'ab'.repeat(32),
        pollToken: 'cd'.repeat(32),
        expiresInSeconds: 90,
      }),
    });
  });
  let polls = 0;
  await page.route(/\/auth\/session$/, async (route) => {
    polls += 1;
    if (polls < 2) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'pending' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'authenticated',
        token: 'sess-e2e',
        account: E2E_ACCOUNT,
      }),
    });
  });

  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByText('Signed in')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('basis')).toBeVisible();
  await expect(page.getByText(/Link a Lightning Address so gifts can reach you/i)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
});

test('signed-in session hydrates, then links and unlinks a Lightning Address', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });

  await page.route(/\/me\/lightning-address$/, async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...E2E_ACCOUNT,
          lightningAddress: 'alice@walletofsatoshi.com',
        }),
      });
      return;
    }
    if (method === 'DELETE') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...E2E_ACCOUNT, lightningAddress: null }),
      });
      return;
    }
    await route.continue();
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(E2E_ACCOUNT),
    });
  });

  await page.goto('/login');
  await expect(page.getByText('Signed in')).toBeVisible();
  await expect(page.getByText(/Link a Lightning Address so gifts can reach you/i)).toBeVisible();

  await page.getByLabel('Lightning Address').fill('alice@walletofsatoshi.com');
  await page.getByRole('button', { name: 'Link address' }).click();

  await expect(page.getByText('alice@walletofsatoshi.com')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unlink' })).toBeVisible();
  await expect(page.getByRole('button', { name: /verify/i })).toHaveCount(0);
  await expect(page.getByText(/not yet verified/i)).toHaveCount(0);
  await expect(page.getByText('Verified')).toHaveCount(0);

  await page.getByRole('button', { name: 'Unlink' }).click();
  await expect(page.getByRole('button', { name: 'Link address' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(
    page.getByRole('button', { name: 'Log in with your Lightning wallet' }),
  ).toBeVisible();
});
