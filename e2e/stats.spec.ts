import { expect, test } from '@playwright/test';

const FIXTURE = {
  totalSats: 1500,
  totalBtc: '0.00001500',
  totalUsd: '1.43',
  giftCount: 3,
  recipientCount: 2,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-07-01T00:00:00.000Z',
  spendOverTime: [
    {
      day: '2026-06-01',
      sats: 500,
      cumulativeSats: 500,
      btc: '0.00000500',
      cumulativeBtc: '0.00000500',
      usd: '0.48',
      cumulativeUsd: '0.48',
    },
    {
      day: '2026-06-02',
      sats: 0,
      cumulativeSats: 500,
      btc: '0.00000000',
      cumulativeBtc: '0.00000500',
      usd: '0.00',
      cumulativeUsd: '0.48',
    },
    {
      day: '2026-07-01',
      sats: 1000,
      cumulativeSats: 1500,
      btc: '0.00001000',
      cumulativeBtc: '0.00001500',
      usd: '0.95',
      cumulativeUsd: '1.43',
    },
  ],
  byRecipient: [
    { recipient: 'alice', giftCount: 2, sats: 1000, btc: '0.00001000', usd: '0.95' },
    { recipient: 'bob', giftCount: 1, sats: 500, btc: '0.00000500', usd: '0.48' },
  ],
  byMonth: [
    { month: '2026-06', giftCount: 2, sats: 500, btc: '0.00000500', usd: '0.48' },
    { month: '2026-07', giftCount: 1, sats: 1000, btc: '0.00001000', usd: '0.95' },
  ],
  fx: {
    quote: 'BTC-USD',
    dayBasis: 'utc',
    source: 'coinbase-exchange-daily-close',
  },
};

const EMPTY = {
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

test('GET /gifts/stats is proxied', async ({ request }) => {
  const res = await request.get('/gifts/stats');
  expect([200, 502, 503]).toContain(res.status());
});

test('GET /gifts is proxied', async ({ request }) => {
  const res = await request.get('/gifts?day=2026-06-01');
  expect([200, 400, 502, 503]).toContain(res.status());
});

test('stats page shows total spend over time', async ({ page }) => {
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FIXTURE),
    });
  });
  await page.goto('/stats');
  await expect(page.getByRole('heading', { name: 'Total spend over time' })).toBeVisible();
  await expect(page.locator('dl').getByText('₿1,500')).toBeVisible();
  await expect(page.locator('dl').getByText('$1.43')).toBeVisible();
  const chart = page.getByLabel('Spend over time in ₿');
  await expect(chart.getByRole('link', { name: '2026-06-01' })).toHaveAttribute(
    'href',
    '/stats/2026-06-01',
  );
  await expect(chart.getByRole('link', { name: '2026-07-01' })).toHaveAttribute(
    'href',
    '/stats/2026-07-01',
  );
  await expect(page.getByRole('link', { name: '2026-06-02' })).toHaveCount(0);
  await chart.getByRole('link', { name: '2026-06-01' }).click();
  await expect(page).toHaveURL(/\/stats\/2026-06-01$/);
  await expect(page.getByText('alice')).toBeVisible();
});

test('stats page empty copy', async ({ page }) => {
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(EMPTY),
    });
  });
  await page.goto('/stats');
  await expect(page.getByText('No gifts recorded yet.')).toBeVisible();
});

test('stats page loading copy', async ({ page }) => {
  await page.route('**/gifts/stats', () => new Promise(() => undefined));
  await page.goto('/stats');
  await expect(page.getByText('Loading…')).toBeVisible();
});

test('stats page error retry', async ({ page }) => {
  await page.route('**/gifts/stats', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/stats');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
