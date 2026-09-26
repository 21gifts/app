import { expect, test } from '@playwright/test';

const DAYS = [
  '2026-09-20',
  '2026-09-21',
  '2026-09-22',
  '2026-09-23',
  '2026-09-24',
  '2026-09-25',
  '2026-09-26',
];

const TABLE = {
  days: DAYS,
  rows: [
    {
      accountId: 'acc_ada',
      name: 'Ada',
      days: ['blocked', 'missed', 'paid', 'blocked', 'blocked', 'blocked', 'blocked'],
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('Function: PayoutsPage — staff open the payout table', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/funding/payout-days', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TABLE),
    });
  });
  await page.goto('/moderate/payouts');
  await expect(page.getByRole('heading', { name: 'Payout per person' })).toBeVisible();
});

test('Function: FundingPayoutsScreen — a member name links to the profile', async ({ page }) => {
  await seedAdaSession(page, 'moderator');
  await page.route('**/funding/payout-days', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TABLE),
    });
  });
  await page.goto('/moderate/payouts');
  await expect(page.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/members/acc_ada');
});

test('Function: fetchFundingPayoutDays — empty window stays a sentence', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/funding/payout-days', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ days: DAYS, rows: [] }),
    });
  });
  await page.goto('/moderate/payouts');
  await expect(page.getByText('Nobody was entitled in these seven days.')).toBeVisible();
});

test('Function: proxyFundingPayoutDaysGet — payout days without a session are 401', async ({
  request,
}) => {
  expect((await request.get('/funding/payout-days')).status()).toBe(401);
});
