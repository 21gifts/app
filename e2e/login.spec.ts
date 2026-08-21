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

test('Wallet of Satoshi login shows uppercase lightning URI and copies the LNURL', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockPendingAuth(page);
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();

  await expect(page.getByRole('img', { name: 'Lightning login QR code' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open in wallet' })).toHaveAttribute(
    'href',
    `lightning:${LNURL.toUpperCase()}`,
  );
  await expect(page.getByText(/Wallet of Satoshi: open Scan in the app/i)).toBeVisible();

  await page.getByRole('button', { name: 'Copy login code' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => navigator.clipboard.readText())).toBe(LNURL);
});

test('login shows an error when the LNURL challenge cannot start', async ({ page }) => {
  await page.route(/\/auth\/lnurl$/, async (route) => {
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in with your Lightning wallet' }).click();
  await expect(page.getByText('Something went wrong. Please try again.')).toBeVisible();
});
