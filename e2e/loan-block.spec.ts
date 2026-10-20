import { expect, test, type Page } from '@playwright/test';
import { fulfillSpot } from './fx-spot';

const LOAN_ID = '5b1e7c2a-3f4d-4e8a-9c6b-2d7f8a1e4c30';

/** A loan that still collects: half of ₿21'000 lent, 30 daily payments. */
const COLLECTING = {
  id: LOAN_ID,
  accountId: 'acc-mira',
  name: 'Mira',
  text: 'A second-hand oven for the bakery corner',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 10_500,
  goalSats: 21_000,
  goalRepayable: true,
  goalTermDays: 30,
  payable: true,
  hasPhoto: false,
  role: 'basis',
  replyCount: 0,
};

async function signIn(page: Page): Promise<void> {
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
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: null,
        lightningAddressVerified: false,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
      }),
    });
  });
}

async function feedOf(page: Page, messages: readonly object[]): Promise<void> {
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages }),
    });
  });
  await page.route('**/forum/messages/**/replies', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
}

async function openAll(page: Page): Promise<void> {
  await page.goto('/welcome');
  await page.getByRole('combobox', { name: 'Forum view' }).click();
  await page.getByRole('option', { name: 'All', exact: true }).click();
}

test('Function: LoanBlock — a feed loan shows what is lent and reads no repayment ledger', async ({
  page,
}) => {
  await signIn(page);
  await fulfillSpot(page);
  const ledgerReads: string[] = [];
  page.on('request', (request) => {
    if (/\/messages\/[^/]+\/repayment$/.test(new URL(request.url()).pathname)) {
      ledgerReads.push(request.url());
    }
  });
  await feedOf(page, [
    COLLECTING,
    { ...COLLECTING, id: '6c2f8d3b-4a5e-4f9b-8d7c-3e8a9b2f5d41', sats: 21_000 },
  ]);
  await openAll(page);
  const blocks = page.getByRole('region', { name: 'Loan request' });
  await expect(blocks).toHaveCount(2);
  await expect(blocks.first()).toHaveAttribute('data-loan-block', 'collecting');
  await expect(blocks.first().getByText(/of ₿21'000 lent$/)).toBeVisible();
  await expect(blocks.first().getByRole('button', { name: 'Lend' })).toBeVisible();
  await expect(blocks.nth(1)).toHaveAttribute('data-loan-block', 'funded');
  await expect(blocks.nth(1).getByText('Fully funded', { exact: true })).toBeVisible();
  await expect(blocks.nth(1).getByRole('button', { name: 'Lend' })).toHaveCount(0);
  await expect(blocks.first().getByRole('link', { name: 'Repayment list' })).toHaveAttribute(
    'href',
    `/messages/${LOAN_ID}/repayment-list`,
  );
  expect(ledgerReads).toEqual([]);
});

test('Function: forumAskPercent — a fiat loan shows its own percent while its sats decide lending', async ({
  page,
}) => {
  await signIn(page);
  await fulfillSpot(page);
  const fiatLoan = { ...COLLECTING, goalCurrency: 'USD', goalAmount: '20' };
  await feedOf(page, [
    { ...fiatLoan, sats: 5_000, amountUsd: '10.00' },
    { ...fiatLoan, id: '7d3a9e4c-5b6f-4a0c-9e8d-4f9b0c3a6e52', sats: 21_000, amountUsd: '10.00' },
  ]);
  await openAll(page);
  const blocks = page.getByRole('region', { name: 'Loan request' });
  await expect(blocks).toHaveCount(2);
  await expect(blocks.first()).toHaveAttribute('data-loan-block', 'collecting');
  await expect(blocks.first().getByText('50%')).toBeVisible();
  await expect(blocks.nth(1)).toHaveAttribute('data-loan-block', 'funded');
  await expect(blocks.nth(1).getByText('Fully funded', { exact: true })).toBeVisible();
  await expect(blocks.nth(1).getByRole('button', { name: 'Lend' })).toHaveCount(0);
  await blocks.first().getByRole('button', { name: 'Lend' }).click();
  await expect(page.getByLabel('Amount to lend')).toBeFocused();
});

test('Lend opens the money reaction and puts the focus in its amount field', async ({ page }) => {
  await signIn(page);
  await fulfillSpot(page);
  await feedOf(page, [COLLECTING]);
  await openAll(page);
  await page.getByRole('button', { name: 'Lend' }).click();
  const amount = page.getByLabel('Amount to lend');
  await expect(amount).toBeFocused();
  await expect(page.getByLabel('Your reaction')).toBeVisible();
});

test('Function: LoanPayNotice — the pay step says Lend and how the loan comes back', async ({
  page,
}) => {
  await signIn(page);
  await fulfillSpot(page);
  await feedOf(page, [COLLECTING]);
  await page.route(new RegExp(`/messages/${LOAN_ID}/invoice$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ pr: 'lnbc2100n1example', amountSats: 210 }),
    });
  });
  await page.goto('/welcome?visual=wallet-pay-confirm');
  await page.getByRole('combobox', { name: 'Forum view' }).click();
  await page.getByRole('option', { name: 'All', exact: true }).click();
  await page.getByRole('button', { name: 'Lend' }).click();
  await page.getByLabel('Amount to lend').fill('210');
  await page.getByLabel('Your reaction').fill('Count me in!');
  const form = page.getByLabel('Your reaction').locator('xpath=ancestor::form');
  await form.getByRole('button', { name: 'Post' }).click();
  // The notice stays on the page in the reaction form; the sheet only holds the last tap.
  await expect(form.locator('[data-loan-notice="lend"]')).toHaveText(
    'You are lending to Mira. Once the loan is fully funded, you get it back in 30 daily payments.',
  );
  const sheet = page.getByRole('dialog', { name: 'Lend to Mira' });
  await expect(sheet.getByText('₿210', { exact: true })).toBeVisible();
  await expect(sheet.getByText(/^\$\d/)).toBeVisible();
  await expect(sheet.locator('[data-loan-notice]')).toHaveCount(0);
  await expect(sheet.getByRole('button', { name: 'Lend ₿210 · $0.21', exact: true })).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Send', exact: true })).toHaveCount(0);
});

test('the open note shows Paid back once every share is paid', async ({ page }) => {
  await fulfillSpot(page);
  await page.route(`**/public-messages/${LOAN_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...COLLECTING, sats: 21_000 }),
    });
  });
  await page.route(`**/public-messages/${LOAN_ID}/replies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });
  await page.route(`**/messages/${LOAN_ID}/repayment`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currency: 'BTC',
        fundedAt: '2026-09-01T12:00:00.000Z',
        termDays: 2,
        daysDue: 2,
        daysPaid: 2,
        unassignedSats: 0,
        givers: [
          {
            accountId: 'acc-tove',
            name: 'Tove',
            username: 'tove',
            givenSats: 21_000,
            givenAmount: null,
          },
        ],
        repayments: [0, 1].map((dayIndex) => ({
          dayIndex,
          dueOn: dayIndex === 0 ? '2026-09-02' : '2026-09-03',
          accountId: 'acc-tove',
          name: 'Tove',
          username: 'tove',
          amount: null,
          sats: 10_500,
          status: 'paid',
          via: 'lightning',
        })),
        next: null,
      }),
    });
  });
  await page.goto(`/messages/${LOAN_ID}`);
  const block = page.getByRole('region', { name: 'Loan request' });
  await expect(block).toHaveAttribute('data-loan-block', 'repaid');
  await expect(block.getByText('Paid back', { exact: true })).toBeVisible();
  await expect(block.getByRole('img', { name: '100% paid back' })).toBeVisible();
  await expect(block.getByRole('button', { name: 'Lend' })).toHaveCount(0);
});
