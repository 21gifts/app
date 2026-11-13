import { expect, test, type Page } from '@playwright/test';

/** Self-reported series with a day on or after the wallet release. */
const WALLET_STATS_FOR_USAGE = {
  walletCount: 80,
  fundedWalletCount: 48,
  totalSats: 500000,
  totalBtc: '0.00500000',
  asOf: '2026-11-12T08:00:00.000Z',
  balanceOverTime: [
    {
      day: '2026-11-09',
      totalSats: 200000,
      totalBtc: '0.00200000',
      walletCount: 40,
      fundedWalletCount: 20,
    },
    {
      day: '2026-11-12',
      totalSats: 500000,
      totalBtc: '0.00500000',
      walletCount: 80,
      fundedWalletCount: 48,
    },
  ],
};

/**
 * Serves wallet totals so `/stats` and `/stats/wallet` can show the wallets chart.
 *
 * @param page - Playwright page.
 */
async function stubWalletStats(page: Page): Promise<void> {
  await page.route('**/wallets/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(WALLET_STATS_FOR_USAGE),
    });
  });
}

test('Function: WalletUsagePage — wallet usage heading is visible', async ({ page }) => {
  await page.goto('/stats/wallet');
  await expect(page.getByRole('heading', { level: 1, name: 'Wallet usage' })).toBeVisible();
});

test('Function: WalletUsageLoader — loaded usage replaces the loading line', async ({ page }) => {
  await page.goto('/stats/wallet');
  await expect(
    page.getByText('661 payments since the release, from 71 active wallets.'),
  ).toBeVisible();
  await expect(page.getByText('Loading…')).toHaveCount(0);
});

test('Function: WalletUsageDashboard — purpose chart and all-flows table are visible', async ({
  page,
}) => {
  await page.goto('/stats/wallet');
  await expect(page.getByRole('heading', { name: 'Payments per day by purpose' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'All flows' })).toBeVisible();
});

test('Function: WalletFlowDiagram — the Tondo fund diagram names the account', async ({ page }) => {
  await page.goto('/stats/wallet');
  await expect(page.getByRole('img', { name: 'Tondo fund' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Member wallets' })).toBeVisible();
});

test('Function: proxyWalletUsageGet — GET /wallets/usage returns the aggregate', async ({
  request,
}) => {
  const res = await request.get('/wallets/usage');
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { totals: { paymentCount: number } };
  expect(body.totals.paymentCount).toBe(661);
});

test('Function: fetchWalletUsage — the page shows 661 payments and the forum pace', async ({
  page,
}) => {
  await page.goto('/stats/wallet');
  await expect(
    page.getByText('661 payments since the release, from 71 active wallets.'),
  ).toBeVisible();
  await expect(
    page.getByText('The forum is paid 37 times as often per day as in the 28 days before.'),
  ).toBeVisible();
});

test('Function: accountBalances — the Tondo fund balance is the last day end', async ({ page }) => {
  await page.goto('/stats/wallet');
  await expect(page.getByText("₿425'057")).toBeVisible();
});

test('Function: formatCount — payment and sending counts use grouped figures', async ({ page }) => {
  await page.goto('/stats/wallet');
  await expect(page.getByText('661', { exact: true })).toBeVisible();
  await expect(page.getByText('33 sending')).toBeVisible();
});

test('Function: OverTimeChart — wallets per day draws the balance line', async ({ page }) => {
  await stubWalletStats(page);
  await page.goto('/stats/wallet');
  await expect(page.getByRole('group', { name: 'Wallets per day' })).toBeVisible();
  await expect(page.getByText('48 with a balance')).toBeVisible();
});

test('selecting one usage day keeps the all-days flow table', async ({ page }) => {
  await page.goto('/stats/wallet');
  await expect(page.getByText('Balance at start of day')).toHaveCount(0);
  await page.getByLabel('Day').selectOption('2026-11-10');
  await expect(page.getByText('Balance at start of day')).toBeVisible();
  await expect(page.getByRole('table')).toContainText("₿471'705");
});

test('Count mode drops the balance ribbons', async ({ page }) => {
  await page.goto('/stats/wallet');
  await page
    .getByRole('group', { name: 'Flow metric' })
    .getByRole('button', { name: 'Count' })
    .click();
  await expect(page.getByText('Balance at end of day')).toHaveCount(0);
  await expect(page.getByText('Fees')).toHaveCount(0);
});

test('a failed usage fetch shows one quiet error line', async ({ page }) => {
  await page.route('**/wallets/usage', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/stats/wallet');
  await expect(page.getByText('Could not load wallet usage. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0);
});

test('a failed wallet-stats fetch hides wallets per day', async ({ page }) => {
  await page.goto('/stats/wallet');
  await expect(page.getByRole('heading', { name: 'Wallets per day' })).toHaveCount(0);
  await expect(page.getByText('33 sending')).toBeVisible();
});

test('the wallets section on /stats links to wallet usage', async ({ page }) => {
  await stubWalletStats(page);
  await page.goto('/stats');
  await page.getByRole('link', { name: 'See how the wallet is used' }).click();
  await expect(page).toHaveURL(/\/stats\/wallet$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Wallet usage' })).toBeVisible();
});
