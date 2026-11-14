import { expect, test } from '@playwright/test';

const TABLE = {
  windowDays: 30,
  today: '2026-09-26',
  shops: [
    {
      noteId: 'note_bakery',
      name: 'Bakery',
      npub: null,
      accountId: 'acc_bake',
      username: null,
      activeDays: 0,
      lastChargeDay: null,
    },
    {
      noteId: 'note_cafe',
      name: 'Corner Café',
      npub: 'npub1corner',
      accountId: 'acc_till',
      username: 'cornertill',
      activeDays: 12,
      lastChargeDay: '2026-09-25',
    },
  ],
};

async function seedAdaSession(
  page: import('@playwright/test').Page,
  role: 'basis' | 'moderator' | 'founder' = 'founder',
): Promise<void> {
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
        role,
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
        funding:
          role === 'basis'
            ? null
            : {
                status: 'none',
                trialUtcDate: null,
                admittedAt: null,
                reviewedByName: null,
              },
      }),
    });
  });
}

test('Function: ShopActivityPage — staff open the shop table', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/shops/activity/shops', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TABLE),
    });
  });
  await page.goto('/moderate/shops');
  await expect(page.getByRole('heading', { name: 'Activity per shop' })).toBeVisible();
});

test('Function: ShopActivityShopsScreen — a shop name links to the shop page', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.route('**/shops/activity/shops', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TABLE),
    });
  });
  await page.goto('/moderate/shops');
  await expect(page.getByRole('link', { name: 'Corner Café' })).toHaveAttribute(
    'href',
    '/npub1corner',
  );
  await expect(page.getByRole('rowheader', { name: 'Bakery' })).toBeVisible();
  await expect(page.getByText('Inactive', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Never', { exact: true })).toBeVisible();
});

test('Function: fetchShopActivityShops — an api 403 shows the forbidden copy', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.route('**/shops/activity/shops', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Forbidden' }),
    });
  });
  await page.goto('/moderate/shops');
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
});

test('Function: proxyShopActivityShopsGet — the shop table without a session is 401', async ({
  request,
}) => {
  expect((await request.get('/shops/activity/shops')).status()).toBe(401);
});
