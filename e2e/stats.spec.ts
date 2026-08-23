import { expect, test } from '@playwright/test';

const FIXTURE = {
  totalSats: 1500,
  giftCount: 3,
  recipientCount: 2,
  firstPaidAt: '2026-06-01T00:00:00.000Z',
  lastPaidAt: '2026-07-01T00:00:00.000Z',
  spendOverTime: [
    { day: '2026-06-01', sats: 500, cumulativeSats: 500 },
    { day: '2026-06-02', sats: 0, cumulativeSats: 500 },
    { day: '2026-07-01', sats: 1000, cumulativeSats: 1500 },
  ],
  byRecipient: [
    { recipient: 'alice', giftCount: 2, sats: 1000 },
    { recipient: 'bob', giftCount: 1, sats: 500 },
  ],
  byMonth: [
    { month: '2026-06', giftCount: 2, sats: 500 },
    { month: '2026-07', giftCount: 1, sats: 1000 },
  ],
};

const EMPTY = {
  totalSats: 0,
  giftCount: 0,
  recipientCount: 0,
  firstPaidAt: null,
  lastPaidAt: null,
  spendOverTime: [],
  byRecipient: [],
  byMonth: [],
};

test('GET /gifts/stats is proxied', async ({ request }) => {
  const res = await request.get('/gifts/stats');
  expect([200, 502, 503]).toContain(res.status());
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
