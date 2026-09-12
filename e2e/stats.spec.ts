import { expect, test } from '@playwright/test';

const FX_USD = {
  quote: 'BTC-USD',
  dayBasis: 'utc',
  source: 'coinbase-exchange-daily-close',
  quotes: [{ code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' }],
};

const FX_ALL = {
  quote: 'BTC-USD',
  dayBasis: 'utc',
  source: 'coinbase-exchange-daily-close',
  quotes: [
    { code: 'USD', pair: 'BTC-USD', source: 'coinbase-exchange-daily-close' },
    { code: 'CHF', pair: 'USD-CHF', source: 'ecb-daily' },
    { code: 'EUR', pair: 'USD-EUR', source: 'ecb-daily' },
    { code: 'PHP', pair: 'USD-PHP', source: 'ecb-daily' },
  ],
};

const FIXTURE = {
  totalSats: 1500,
  totalBtc: '0.00001500',
  totalUsd: '1.43',
  totalChf: '1.20',
  totalEur: '1.30',
  totalPhp: '80.00',
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
      chf: '0.40',
      eur: '0.44',
      php: '27.00',
      cumulativeChf: '0.40',
      cumulativeEur: '0.44',
      cumulativePhp: '27.00',
    },
    {
      day: '2026-06-02',
      sats: 0,
      cumulativeSats: 500,
      btc: '0.00000000',
      cumulativeBtc: '0.00000500',
      usd: '0.00',
      cumulativeUsd: '0.48',
      chf: '0.00',
      eur: '0.00',
      php: '0.00',
      cumulativeChf: '0.40',
      cumulativeEur: '0.44',
      cumulativePhp: '27.00',
    },
    {
      day: '2026-07-01',
      sats: 1000,
      cumulativeSats: 1500,
      btc: '0.00001000',
      cumulativeBtc: '0.00001500',
      usd: '0.95',
      cumulativeUsd: '1.43',
      chf: '0.80',
      eur: '0.86',
      php: '53.00',
      cumulativeChf: '1.20',
      cumulativeEur: '1.30',
      cumulativePhp: '80.00',
    },
  ],
  byRecipient: [
    {
      recipient: 'alice',
      giftCount: 2,
      sats: 1000,
      btc: '0.00001000',
      usd: '0.95',
      chf: '0.80',
      eur: '0.86',
      php: '53.00',
    },
    {
      recipient: 'bob',
      giftCount: 1,
      sats: 500,
      btc: '0.00000500',
      usd: '0.48',
      chf: '0.40',
      eur: '0.44',
      php: '27.00',
    },
  ],
  byMonth: [
    {
      month: '2026-06',
      giftCount: 2,
      sats: 500,
      btc: '0.00000500',
      usd: '0.48',
      chf: '0.40',
      eur: '0.44',
      php: '27.00',
    },
    {
      month: '2026-07',
      giftCount: 1,
      sats: 1000,
      btc: '0.00001000',
      usd: '0.95',
      chf: '0.80',
      eur: '0.86',
      php: '53.00',
    },
  ],
  fx: FX_ALL,
};

const EMPTY = {
  totalSats: 0,
  totalBtc: '0.00000000',
  totalUsd: '0.00',
  totalChf: '0.00',
  totalEur: '0.00',
  totalPhp: '0.00',
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
  fx: FX_USD,
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
  await expect(page.getByRole('group', { name: 'Fiat currency' })).toBeVisible();
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
