import { expect, test, type Page } from '@playwright/test';
import { fulfillSpot } from './fx-spot';
import {
  fulfillLedger,
  fulfillMyLoans,
  ledgerA,
  loanA,
  loanCollecting,
  myLoans,
  productionPhpLoans,
} from './loan-fixtures';

async function seedMember(page: Page): Promise<void> {
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

async function seedLoan(page: Page): Promise<void> {
  await seedMember(page);
  await page.clock.install({ time: new Date('2026-10-07T10:00:00.000Z') });
  await fulfillSpot(page);
  await fulfillMyLoans(page, myLoans([loanA]));
  await fulfillLedger(page, loanA.messageId, ledgerA);
}

test('/loans/repay shows the current due amount', async ({ page }) => {
  await seedLoan(page);
  await page.goto('/loans/repay');
  await expect(page.getByText('Due today')).toBeVisible();
  await expect(page.getByText("₿1'000").first()).toBeVisible();
});

test('Function: LoanPayMore — Max fills the exact limit and above-max input is blocked', async ({
  page,
}) => {
  await seedLoan(page);
  let prepayRequests = 0;
  await page.route('**/messages/loan-a/repayment', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    prepayRequests += 1;
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/loans/repay?visual=repay-ready');
  const input = page.getByLabel('Amount (₿)');
  await page.getByRole('button', { name: 'Max' }).click();
  await expect(input).toHaveValue('19000');
  await input.fill('19001');
  await expect(page.getByText("Enter at most ₿19'000 · $19.00.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay this amount' })).toBeDisabled();
  expect(prepayRequests).toBe(0);
});

test('a successful prepay prepares a bill, pays it from the wallet, and reloads', async ({
  page,
}) => {
  await seedMember(page);
  await page.clock.install({ time: new Date('2026-10-07T10:00:00.000Z') });
  await fulfillSpot(page);
  await fulfillLedger(page, loanA.messageId, ledgerA);
  let prepayBody: unknown = null;
  let walletBody: unknown = null;
  let loanReads = 0;
  await page.route('**/me/loans', async (route) => {
    loanReads += 1;
    const repaid = walletBody === null ? loanA : { ...loanA, repaidSats: loanA.repaidSats + 500 };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(myLoans([repaid])),
    });
  });
  await page.route('**/messages/loan-a/repayment', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    prepayBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        amountSats: 500,
        amount: null,
        bills: [
          {
            dayIndex: 12,
            recipientAccountId: 'acc_bruno',
            name: 'Bruno',
            username: 'bruno',
            amountSats: 500,
            amount: null,
            pr: 'lnbc500nprepay',
            sparkInvoice: 'spark-prepay-500',
          },
        ],
        waiting: [],
      }),
    });
  });
  await page.route('**/e2e/wallet-send', async (route) => {
    walletBody = route.request().postDataJSON();
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/loans/repay?visual=repay-e2e-payment');
  await page.getByLabel('Amount (₿)').fill('500');
  await page.getByRole('button', { name: 'Pay this amount' }).click();
  await expect.poll(() => prepayBody).toEqual({ amount: '500' });
  await expect.poll(() => walletBody).toEqual({ input: 'spark-prepay-500', amountSats: 500 });
  await expect.poll(() => loanReads).toBeGreaterThan(1);
  await page.clock.runFor(4_000);
  await expect(page.getByLabel('Amount (₿)')).toHaveValue('');
});

test('a collecting loan confirms and completes its first payment, ending collecting', async ({
  page,
}) => {
  await seedMember(page);
  await page.clock.install({ time: new Date('2026-10-07T10:00:00.000Z') });
  await fulfillSpot(page);
  let prepayRequests = 0;
  let collectingPrepayBody: unknown = null;
  let walletPayments = 0;
  let closed = false;
  await page.route('**/me/loans', async (route) => {
    const item = closed
      ? {
          ...loanCollecting,
          closedAt: '2026-10-07T10:00:00.000Z',
          repaidSats: walletPayments > 0 ? 8_000 : 0,
        }
      : loanCollecting;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(myLoans([item])),
    });
  });
  await page.route('**/messages/loan-collecting/repayment', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    prepayRequests += 1;
    collectingPrepayBody = route.request().postDataJSON();
    closed = true;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        amountSats: 8_000,
        amount: null,
        bills: [
          {
            dayIndex: 0,
            recipientAccountId: 'acc_lender',
            name: 'Lender',
            username: null,
            amountSats: 8_000,
            amount: null,
            pr: 'lnbc8000ncollecting',
            sparkInvoice: 'spark-collecting-8000',
          },
        ],
        waiting: [],
      }),
    });
  });
  await page.route('**/e2e/wallet-send', async (route) => {
    walletPayments += 1;
    await route.fulfill({ status: 204, body: '' });
  });
  await page.goto('/loans/repay?visual=repay-e2e-payment');
  await page.getByRole('button', { name: 'Max' }).click();
  await page.getByRole('button', { name: 'Pay this amount' }).click();
  const dialog = page.getByRole('dialog', { name: 'Pay and end collecting?' });
  await expect(dialog).toContainText('This first payment ends collecting permanently.');
  await dialog.getByRole('button', { name: "Pay ₿8'000 · $8.00 and end collecting" }).click();
  await expect.poll(() => prepayRequests).toBe(1);
  expect(collectingPrepayBody).toEqual({ amount: '8000' });
  await expect.poll(() => walletPayments).toBe(1);
  await page.clock.runFor(4_000);
  await expect(page.getByRole('button', { name: 'End collecting' })).toHaveCount(0);
});

test('end collecting requires confirmation and posts only after confirmation', async ({ page }) => {
  await seedMember(page);
  await fulfillSpot(page);
  await fulfillMyLoans(page, myLoans([loanCollecting]));
  let closeRequests = 0;
  await page.route('**/messages/loan-collecting/repayment/close', async (route) => {
    closeRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fundedAt: null,
        closedAt: '2026-10-07T10:00:00.000Z',
        collectedSats: 8_000,
        collectedAmount: null,
      }),
    });
  });
  await page.goto('/loans/repay');
  await page.getByRole('button', { name: 'End collecting' }).click();
  expect(closeRequests).toBe(0);
  const dialog = page.getByRole('dialog', { name: 'End collecting?' });
  await expect(dialog).toContainText('This is final.');
  await dialog.getByRole('button', { name: 'End collecting permanently' }).click();
  await expect.poll(() => closeRequests).toBe(1);
});

test('the welcome loans card Send link navigates client-side to repayment', async ({ page }) => {
  await seedLoan(page);
  await page.goto('/welcome');
  const card = page.getByRole('region', { name: 'Your loan' });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/loans\/repay$/);
  await expect(page.getByText('Due today')).toBeVisible();
});

test('the welcome loans card keeps two PHP loans on their frozen figures', async ({ page }) => {
  await seedMember(page);
  await page.clock.install({ time: new Date('2026-10-07T10:00:00.000Z') });
  await fulfillSpot(page);
  await fulfillMyLoans(page, myLoans(productionPhpLoans));
  await page.goto('/welcome');
  const card = page.getByRole('region', { name: 'Your loans (2)' });
  await expect(card).toContainText("₱10'000.00");
  await expect(card).toContainText("₱15'000.00");
  await expect(card).not.toContainText("₱27'051.19");
  await expect(card.getByText('Loan for a delivery bike to reach more customers.')).toBeVisible();
  await expect(
    card.getByText('Small loan for school books and a uniform for my daughter.'),
  ).toBeVisible();
  await expect(card.getByRole('button', { name: 'Show loan', exact: true })).toHaveCount(0);
  await card.getByRole('button', { name: 'Show loans' }).click();
  await expect(
    card.getByRole('link', { name: 'Loan for a delivery bike to reach more customers.' }),
  ).toBeVisible();
  await expect(
    card.getByRole('link', { name: 'Small loan for school books and a uniform for my daughter.' }),
  ).toBeVisible();
});

test('the Menu loan Send row closes the Menu and opens repayment', async ({ page }) => {
  await seedLoan(page);
  await page.goto('/welcome');
  await page.getByRole('button', { name: 'Menu' }).click();
  const row = page.getByText('Loan repayment due today').locator('..').locator('..');
  await row.getByRole('link', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/loans\/repay$/);
  await expect(page.getByText('Loan repayment due today')).toHaveCount(0);
  await expect(page.getByText('Due today')).toBeVisible();
});

test('an own funded credit links to the repayment screen', async ({ page }) => {
  await seedLoan(page);
  await page.route(/\/messages(?:\?|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        messages: [
          {
            id: 'loan-a',
            accountId: 'acc_e2e',
            name: 'Ada',
            text: loanA.text,
            createdAt: loanA.createdAt,
            sats: loanA.sats,
            goalSats: loanA.goalSats,
            goalRepayable: true,
            goalTermDays: loanA.termDays,
            payable: true,
            hasPhoto: false,
            role: 'basis',
            replyCount: 0,
          },
        ],
      }),
    });
  });
  await page.goto('/welcome');
  await page.getByRole('combobox', { name: 'Forum view' }).click();
  await page.getByRole('option', { name: 'All', exact: true }).click();
  const repay = page.getByRole('link', { name: 'Repay your loan' });
  await expect(repay).toBeVisible();
  await expect(repay).toHaveAttribute('href', '/loans/repay');
});
