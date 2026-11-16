import { expect, test, type Page } from '@playwright/test';
import { fulfillSpot } from './fx-spot';

const OPEN_LOANS = [
  {
    messageId: 'loan-ada',
    accountId: 'acc_ada',
    name: 'Ada',
    currency: 'CHF',
    outstanding: '12.50',
    overdue: true,
  },
  {
    messageId: 'loan-ben',
    accountId: 'acc/ben',
    name: 'Ben',
    currency: 'BTC',
    outstanding: 1500,
    overdue: false,
  },
];

async function fulfillOpenLoans(page: Page, body: unknown, status: number): Promise<void> {
  await page.route('**/loans/open', async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function seedAda(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route(/\/me$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'acc_e2e',
        linkingKey: `02${'a'.repeat(62)}`,
        role: 'basis',
        name: 'Ada',
        location: null,
        username: 'alice',
        lightningAddress: null,
        lightningAddressVerified: true,
        forumLawsDismissed: true,
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

test('screen /loans default', async ({ page }) => {
  await fulfillSpot(page);
  await fulfillOpenLoans(page, OPEN_LOANS, 200);
  await page.goto('/loans');
  await expect(page.getByRole('heading', { name: 'Open loans' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ada' })).toHaveAttribute(
    'href',
    '/members/acc_ada',
  );
  await expect(page.getByRole('link', { name: 'Ben' })).toHaveAttribute(
    'href',
    '/members/acc%2Fben',
  );
  await expect(page.getByText('CHF 12.50')).toBeVisible();
  await expect(page.getByText("₿1'500 · $1.50")).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Yes' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'No' })).toBeVisible();
  const names = page.getByRole('link', { name: /^(Ada|Ben)$/ });
  await expect(names.nth(0)).toHaveText('Ada');
  await expect(names.nth(1)).toHaveText('Ben');
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toHaveCount(0);
});

test('screen /loans empty', async ({ page }) => {
  await fulfillOpenLoans(page, [], 200);
  await page.goto('/loans');
  await expect(page.getByRole('heading', { name: 'Open loans' })).toBeVisible();
  await expect(page.getByText('No open loans.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('screen /loans loading', async ({ page }) => {
  await page.route('**/loans/open', () => new Promise(() => undefined));
  await page.goto('/loans');
  await expect(page.getByText('Loading open loans…')).toBeVisible();
});

test('screen /loans error', async ({ page }) => {
  await fulfillOpenLoans(page, {}, 500);
  await page.goto('/loans');
  await expect(page.getByRole('alert')).toHaveText(
    'Could not load open loans. Please try again.',
  );
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('screen /loans signed-in', async ({ page }) => {
  await seedAda(page);
  await fulfillSpot(page);
  await fulfillOpenLoans(page, OPEN_LOANS, 200);
  await page.goto('/loans');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ada' })).toBeVisible();
  await expect(page.getByText("₿1'500 · $1.50")).toBeVisible();
});

test('Function: OpenLoansPage — a signed-out visitor opens /loans', async ({ page }) => {
  await fulfillSpot(page);
  await fulfillOpenLoans(page, OPEN_LOANS, 200);
  await page.goto('/loans');
  await expect(page.getByRole('heading', { name: 'Open loans' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to the forum' })).toHaveAttribute(
    'href',
    '/welcome',
  );
});

test('Function: OpenLoansTopRight — Log in without a session and the menu with one', async ({
  page,
}) => {
  await fulfillOpenLoans(page, [], 200);
  await page.goto('/loans');
  await expect(page.getByRole('link', { name: 'Log in' })).toHaveAttribute(
    'href',
    '/login?next=%2Floans',
  );
  await seedAda(page);
  await page.goto('/loans');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0);
});

test('Function: OpenLoansScreen — one row per open loan in api order', async ({ page }) => {
  await fulfillSpot(page);
  await fulfillOpenLoans(page, OPEN_LOANS, 200);
  await page.goto('/loans');
  await expect(page.getByRole('columnheader', { name: 'Borrower' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Outstanding' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Overdue' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ada' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ben' })).toBeVisible();
});

test('Function: fetchOpenLoans — GET /loans/open returns the public list', async ({
  page,
  request,
}) => {
  const response = await request.get('/loans/open');
  expect(response.status()).toBe(200);
  const body: unknown = await response.json();
  expect(Array.isArray(body)).toBe(true);
  await fulfillSpot(page);
  await fulfillOpenLoans(page, OPEN_LOANS, 200);
  await page.goto('/loans');
  await expect(page.getByText('CHF 12.50')).toBeVisible();
});
