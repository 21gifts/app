import { expect, test, type Page } from '@playwright/test';
import { fulfillSpot } from './fx-spot';
import { fulfillLedger, fulfillMyLoans, ledgerA, loanA, myLoans } from './loan-fixtures';

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

test('the welcome loans card Send link navigates client-side to repayment', async ({ page }) => {
  await seedLoan(page);
  await page.goto('/welcome');
  const card = page.getByRole('region', { name: 'Your loan' });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: 'Send' }).click();
  await expect(page).toHaveURL(/\/loans\/repay$/);
  await expect(page.getByText('Due today')).toBeVisible();
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
