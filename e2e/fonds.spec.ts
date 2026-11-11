import { expect, test } from '@playwright/test';
import { fulfillSpot } from './fx-spot';

const FOND_USERNAME = 'tondo-fond';

const SUMMARY = {
  username: FOND_USERNAME,
  receivedSats: 210_000,
  paidOutSats: 21_000,
  feesSats: 210,
  balanceSats: 189_000,
  balanceSyncedAt: '2026-11-11T10:00:00.000Z',
  payoutsPaid: 3,
  payoutsPaidUsd: '3.00',
};

test('e2e:check dynamic path token for /fonds/[username]', async ({ page, request }) => {
  await page.goto('/fonds/[username]');
  // The mock api has no Fond named `[username]`, so the proxy answers 404.
  expect((await request.get('/fonds/[username]/summary')).status()).toBe(404);
});

test('Function: FondPage — public page shows the Fond totals', async ({ page }) => {
  await fulfillSpot(page);
  const response = await page.goto(`/fonds/${FOND_USERNAME}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'tondo-fond' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fond' })).toBeVisible();
  await expect(page.getByText('Received')).toBeVisible();
  await expect(page.getByText("₿210'000")).toBeVisible();
  await expect(page.getByText('$210.00')).toBeVisible();
  await expect(page.getByText('Paid out')).toBeVisible();
  await expect(page.getByText("₿21'000")).toBeVisible();
  await expect(page.getByText('Fees ₿210')).toBeVisible();
  await expect(page.getByText('$0.21')).toBeVisible();
  await expect(page.getByText('Balance')).toBeVisible();
  await expect(page.getByText("₿189'000")).toBeVisible();
  await expect(page.getByText(/as of /)).toBeVisible();
  await expect(page.getByText('3 grant payouts paid (3.00 USD)')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toBeVisible();
});

test('Function: FondSummaryLoader — balance null says not reported yet', async ({ page }) => {
  await fulfillSpot(page);
  await page.route(`**/fonds/${FOND_USERNAME}/summary`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...SUMMARY, balanceSats: null, balanceSyncedAt: null }),
    });
  });
  await page.goto(`/fonds/${FOND_USERNAME}`);
  await expect(page.getByText('not reported yet')).toBeVisible();
  await expect(page.getByText('\u2014')).toBeVisible();
});

test('Function: FondSummaryLoader — 503 shows Try again', async ({ page }) => {
  await page.route(`**/fonds/${FOND_USERNAME}/summary`, async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Fond unavailable' }),
    });
  });
  await page.goto(`/fonds/${FOND_USERNAME}`);
  await expect(page.getByText('Could not load the Fond. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Function: GET — /fonds/tondo-fond/summary proxies the public Fond summary', async ({
  request,
}) => {
  const response = await request.get(`/fonds/${FOND_USERNAME}/summary`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual(SUMMARY);
});

test('Function: fetchFondSummary — another handle answers 404', async ({ page, request }) => {
  expect((await request.get('/fonds/other-fond/summary')).status()).toBe(404);
  await page.goto('/fonds/other-fond');
  await expect(page.getByText('This Fond could not be found.')).toBeVisible();
});

test('Function: proxyFondSummaryGet — GET /fonds/tondo-fond/summary is reachable', async ({
  request,
}) => {
  expect((await request.get(`/fonds/${FOND_USERNAME}/summary`)).status()).toBe(200);
});
