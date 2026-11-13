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

const PAYMENTS = {
  payments: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      direction: 'in',
      amountSats: 21_000,
      paidAt: '2026-11-11T13:31:01.000Z',
      storedFiat: null,
      counterparty: null,
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      direction: 'in',
      amountSats: 10_000,
      paidAt: '2026-11-10T09:15:00.000Z',
      storedFiat: null,
      counterparty: {
        accountId: '44444444-4444-4444-8444-444444444444',
        username: 'alice',
        name: 'Alice',
      },
    },
    {
      id: '55555555-5555-4555-8555-555555555555',
      direction: 'out',
      amountSats: 5_000,
      paidAt: '2026-11-09T18:00:00.000Z',
      storedFiat: { currency: 'USD', amount: '3.00' },
      counterparty: null,
    },
  ],
  next: 'fond-payments-next',
};

const PAYMENTS_MORE = {
  payments: [
    {
      id: '66666666-6666-4666-8666-666666666666',
      direction: 'in',
      amountSats: 1_000,
      paidAt: '2026-11-08T08:00:00.000Z',
      storedFiat: null,
      counterparty: null,
    },
  ],
  next: null,
};

test('e2e:check dynamic path token for /fonds/[username]', async ({ page, request }) => {
  await page.goto('/fonds/[username]');
  // The mock api has no Fond named `[username]`, so the proxy answers 404.
  expect((await request.get('/fonds/[username]/summary')).status()).toBe(404);
  expect((await request.get('/fonds/[username]/payments')).status()).toBe(404);
});

test('Function: FondPage — public page shows the Fond totals', async ({ page }) => {
  await fulfillSpot(page);
  const response = await page.goto(`/fonds/${FOND_USERNAME}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'tondo-fond' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fond' })).toBeVisible();
  await expect(page.getByText('Received').first()).toBeVisible();
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
  await expect(page.getByRole('region', { name: 'Payments' })).toBeVisible();
  await expect(page.getByText('Received').first()).toBeVisible();
  await expect(page.getByText('Private').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Alice' })).toHaveAttribute(
    'href',
    '/members/44444444-4444-4444-8444-444444444444',
  );
  await expect(page.getByText('Alice')).toBeVisible();
  await expect(page.getByText('Sent')).toBeVisible();
  await expect(page.getByText("−₿5'000 · $3.00")).toBeVisible();
  await expect(page.getByText(/^Fee /)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toBeVisible();
});

test('Function: FondPaymentList — empty payments show the empty line', async ({ page }) => {
  await fulfillSpot(page);
  await page.route(`**/fonds/${FOND_USERNAME}/payments`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ payments: [], next: null }),
    });
  });
  await page.goto(`/fonds/${FOND_USERNAME}`);
  await expect(page.getByText('No payments yet.')).toBeVisible();
});

test('Function: FondPaymentList — Show more appends the next page', async ({ page }) => {
  await fulfillSpot(page);
  await page.goto(`/fonds/${FOND_USERNAME}`);
  await expect(page.getByRole('button', { name: 'Show more' })).toBeVisible();
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(page.getByRole('region', { name: 'Payments' }).getByRole('listitem')).toHaveCount(4);
  await expect(page.getByText('Show more')).toHaveCount(0);
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

test('Function: GET — /fonds/tondo-fond/payments proxies the public Fond payments', async ({
  request,
}) => {
  const response = await request.get(`/fonds/${FOND_USERNAME}/payments`);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect(await response.json()).toEqual(PAYMENTS);
  const next = await request.get(`/fonds/${FOND_USERNAME}/payments?before=fond-payments-next`);
  expect(next.status()).toBe(200);
  expect(await next.json()).toEqual(PAYMENTS_MORE);
});

test('Function: fetchFondSummary — another handle answers 404', async ({ page, request }) => {
  expect((await request.get('/fonds/other-fond/summary')).status()).toBe(404);
  await page.goto('/fonds/other-fond');
  await expect(page.getByText('This Fond could not be found.')).toBeVisible();
});

test('Function: fetchFondPayments — the first page loads and another handle answers 404', async ({
  page,
  request,
}) => {
  expect((await request.get('/fonds/other-fond/payments')).status()).toBe(404);
  await fulfillSpot(page);
  await page.goto(`/fonds/${FOND_USERNAME}`);
  await expect(page.getByText('Private').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Show more' })).toBeVisible();
});

test(
  'Function: FondPaymentsError — a refused next page with 400 reloads the list from the first page',
  async ({ page }) => {
    let firstPageRequests = 0;
    await fulfillSpot(page);
    await page.route(`**/fonds/${FOND_USERNAME}/payments*`, async (route) => {
      const before = new URL(route.request().url()).searchParams.get('before');
      if (before !== null) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid payment cursor' }),
        });
        return;
      }
      firstPageRequests += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PAYMENTS),
      });
    });
    await page.goto(`/fonds/${FOND_USERNAME}`);
    const payments = page.getByRole('region', { name: 'Payments' });
    await expect(payments.getByRole('listitem')).toHaveCount(3);
    await page.getByRole('button', { name: 'Show more' }).click();
    await expect.poll(() => firstPageRequests).toBe(2);
    await expect(payments.getByRole('listitem')).toHaveCount(3);
    await expect(payments.getByRole('alert')).toHaveCount(0);
  },
);

test('Function: formatStoredFiat — a stored USD figure shows exactly as stored', async ({ page }) => {
  await fulfillSpot(page);
  await page.route(`**/fonds/${FOND_USERNAME}/payments`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        payments: [
          {
            ...PAYMENTS.payments[2],
            storedFiat: { currency: 'USD', amount: '2.5' },
          },
        ],
        next: null,
      }),
    });
  });
  await page.goto(`/fonds/${FOND_USERNAME}`);
  await expect(page.getByText("−₿5'000 · $2.5")).toBeVisible();
  await expect(page.getByText("−₿5'000 · $2.50")).toHaveCount(0);
});

test('Function: FondPaymentList — another handle is not listed', async ({ page }) => {
  await page.goto('/fonds/other-fond');
  await expect(page.getByText('This Fond could not be found.')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Payments' })).toHaveCount(0);
});

test('Function: proxyFondSummaryGet — GET /fonds/tondo-fond/summary is reachable', async ({
  request,
}) => {
  expect((await request.get(`/fonds/${FOND_USERNAME}/summary`)).status()).toBe(200);
});

test('Function: proxyFondPaymentsGet — GET /fonds/tondo-fond/payments is reachable', async ({
  request,
}) => {
  expect((await request.get(`/fonds/${FOND_USERNAME}/payments`)).status()).toBe(200);
});
