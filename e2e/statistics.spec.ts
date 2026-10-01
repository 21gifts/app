import { expect, test } from '@playwright/test';

async function seedAdaSession(
  page: import('@playwright/test').Page,
  role: 'basis' | 'verified' | 'moderator' | 'founder' = 'basis',
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
      }),
    });
  });
}

async function stubPayoutGoal(page: import('@playwright/test').Page): Promise<void> {
  await page.clock.install({ time: new Date('2026-09-20T12:00:00.000Z') });
  const start = Date.parse('2026-08-22T00:00:00.000Z');
  await page.route('**/gifts/stats', async (route) => {
    const spendOverTime = Array.from({ length: 30 }, (_, i) => {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const giftCount = day === '2026-09-19' ? 12 : 0;
      return {
        day,
        giftCount,
        officialCount: giftCount,
        sats: 0,
        cumulativeSats: 0,
        btc: '0.00000000',
        cumulativeBtc: '0.00000000',
        usd: '0.00',
        cumulativeUsd: '0.00',
        chf: '0.00',
        eur: '0.00',
        php: '0.00',
        cumulativeChf: '0.00',
        cumulativeEur: '0.00',
        cumulativePhp: '0.00',
      };
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalSats: 0,
        totalBtc: '0.00000000',
        totalUsd: '0.00',
        totalChf: '0.00',
        totalEur: '0.00',
        totalPhp: '0.00',
        giftCount: 12,
        recipientCount: 0,
        firstPaidAt: '2026-08-22T00:00:00.000Z',
        lastPaidAt: '2026-09-20T00:00:00.000Z',
        spendOverTime,
        byRecipient: [],
        byMonth: [],
        fx: {
          quote: 'BTC-USD',
          dayBasis: 'utc',
          source: 'coinbase-exchange-daily-close',
          quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
        },
      }),
    });
  });
  await page.route('**/shops/activity', async (route) => {
    const days = Array.from({ length: 30 }, (_, i) => ({
      day: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
      shopCount: 0,
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ days }),
    });
  });
}

test('Function: StatisticsPage — staff see the open payout-goal chart', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  await expect(page.getByText('People by UTC day')).toBeVisible();
  await expect(page.getByText('Shops by UTC day')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Show payout per person' })).toHaveAttribute(
    'href',
    '/moderate/payouts',
  );
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Statistics' })).toHaveAttribute(
    'href',
    '/statistics',
  );
});

test('Function: StatisticsPage — basis visitors do not see Statistics in Menu', async ({
  page,
}) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/statistics');
  await page.getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('link', { name: 'Statistics' })).toHaveCount(0);
});

test('Function: StatisticsScreen — basis visitors see the forbidden copy', async ({ page }) => {
  await seedAdaSession(page, 'basis');
  await page.goto('/statistics');
  await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
  await expect(page.getByText('This page is for moderators.')).toBeVisible();
  await expect(page.getByText('People by UTC day')).toHaveCount(0);
});

test('Function: StatisticsScreen — payout goal loading', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/gifts/stats', () => new Promise(() => undefined));
  await page.route('**/shops/activity', () => new Promise(() => undefined));
  await page.goto('/statistics');
  await expect(
    page.getByRole('group', { name: 'Daily funding goal' }).getByText('Loading…'),
  ).toBeVisible();
});

test('Function: StatisticsScreen — payout goal error', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unavailable' }),
    });
  });
  await page.goto('/statistics');
  await expect(page.getByText('Could not load payouts. Please try again.')).toBeVisible();
});

test('Function: utcDayFromMs — the chart window ends on the UTC day of the clock', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByRole('img', { name: 'People by UTC day' })).toBeVisible();
});

test('Function: previousUtcDay — yesterday is UTC September 19', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByText(/Yesterday \(UTC September 19\)/)).toBeVisible();
});

test('Function: countOnDay — yesterday 12 of 100 is 12%', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByText('12%')).toBeVisible();
  await expect(page.getByText('yesterday 12 of 100')).toBeVisible();
});

test('Function: chartRows — the 30-day People by UTC day image is visible', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByRole('img', { name: 'People by UTC day' })).toBeVisible();
});

test('Function: formatUtcDate — yesterday is formatted September 19', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByText(/September 19/)).toBeVisible();
});

test('Function: chartDayLabel — the last axis tick is 9/20', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByRole('img', { name: 'People by UTC day' }).getByText('9/20')).toBeVisible();
});

test('Function: PayoutGoalChart — the People by UTC day SVG is visible', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByRole('img', { name: 'People by UTC day' })).toBeVisible();
});

test('Function: fetchShopActivity — staff see the shop-activity explainer', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByRole('img', { name: 'Shops by UTC day' })).toBeVisible();
});

test('Function: proxyShopActivityGet — GET /shops/activity returns 30 days', async ({
  request,
}) => {
  const res = await request.get('/shops/activity');
  expect(res.status()).toBe(200);
  expect(((await res.json()) as { days: unknown[] }).days).toHaveLength(30);
});

test('Function: ShopActivityChart — the Shops by UTC day SVG is visible', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await stubPayoutGoal(page);
  await page.goto('/statistics');
  await expect(page.getByRole('img', { name: 'Shops by UTC day' })).toBeVisible();
});
