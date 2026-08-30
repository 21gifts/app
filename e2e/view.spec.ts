import { expect, test } from '@playwright/test';

const KEY = 'a'.repeat(64);
const MISSING_KEY = 'b'.repeat(64);

const VIEW_PROFILE = {
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  createdAt: 1,
};

const EMPTY_STATS = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

test('e2e:check dynamic path token for /view/[viewKey]', async ({ page }) => {
  await page.goto('/view/[viewKey]');
});

test('public view profile default shows name and address', async ({ page }) => {
  await page.route(new RegExp(`/view-key/${KEY}$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(VIEW_PROFILE),
    });
  });
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_STATS),
    });
  });
  await page.goto(`/view/${KEY}`);
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
  await expect(page.getByText('Name')).toBeVisible();
  await expect(page.getByText('Ada')).toBeVisible();
  await expect(page.getByText('Wallet of Satoshi address')).toBeVisible();
  await expect(page.getByText('alice@walletofsatoshi.com')).toBeVisible();
  await expect(page.getByText('Given')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Set up a passkey for this profile' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy view-only link' })).toHaveCount(0);

  await expect(page.getByRole('button', { name: 'Edit name' })).toHaveCount(0);
});

test('public view profile missing shows not-found copy', async ({ page }) => {
  await page.route(new RegExp(`/view-key/${MISSING_KEY}$`), async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Not found' }),
    });
  });
  await page.goto(`/view/${MISSING_KEY}`);
  await expect(page.getByText('This profile could not be found.')).toBeVisible();
});

test('public view profile loading shows Loading…', async ({ page }) => {
  await page.route(new RegExp(`/view-key/${KEY}$`), async () => {
    // never fulfill — keep the loader pending
  });
  await page.goto(`/view/${KEY}`);
  await expect(page.getByText('Loading…')).toBeVisible();
});

test('public view profile error shows Try again and retries', async ({ page }) => {
  let calls = 0;
  await page.route(new RegExp(`/view-key/${KEY}$`), async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'boom' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(VIEW_PROFILE),
    });
  });
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_STATS),
    });
  });
  await page.goto(`/view/${KEY}`);
  await expect(page.getByText('Could not load this profile. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByText('Ada')).toBeVisible();
});

test('signed-in profile shows the copy control without the view-key URL', async ({ page }) => {
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
        role: 'basis',
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: KEY,
      }),
    });
  });
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY_STATS),
    });
  });
  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'Copy view-only link' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'View key' })).toHaveCount(0);
  await expect(page.getByText(new RegExp(`/view/${KEY}`))).toHaveCount(0);
  await expect(page.getByText(KEY)).toHaveCount(0);
});
