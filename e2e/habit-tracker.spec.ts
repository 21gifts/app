import { expect, test } from '@playwright/test';

const payload = {
  week: { start: '2026-09-28', label: '2026-W40', nextAt: 1791129600000 },
  currentWeek: '2026-09-28',
  firstWeek: '2026-09-28',
  habits: [
    {
      id: 'f1',
      accountId: 'f',
      role: 'founder',
      name: 'Founder',
      text: 'Read every day',
      firstWeek: '2026-09-28',
      lastWeek: null,
    },
    {
      id: 'i1',
      accountId: 'i',
      role: 'initiator',
      name: 'Initiator',
      text: 'Walk every day',
      firstWeek: '2026-09-28',
      lastWeek: null,
    },
  ],
  results: [],
  comments: [],
};

test('Function: HabitTrackerPage — visitors can read the Habit-Tracker', async ({
  page,
  request,
}) => {
  expect((await request.get('/habits/data')).status()).toBe(200);
  expect(
    (
      await request.post('/habits/data', {
        data: { action: 'comment', week: payload.week.start, text: 'Hello' },
      })
    ).status(),
  ).toBe(401);
  await page.route('**/habits/data*', (route) => route.fulfill({ json: payload }));
  await page.goto('/habit-tracker');
  await expect(page.getByRole('heading', { name: 'Habit-Tracker', exact: true })).toBeVisible();
  await expect(page.getByText('Read every day')).toBeVisible();
  await expect(page.getByText('Walk every day')).toBeVisible();
  await expect(page.getByRole('radio').first()).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Sign in to comment' })).toBeVisible();
});

test('Function: HabitTracker — empty, loading and error states', async ({ page }) => {
  await page.route('**/habits/data*', (route) =>
    route.fulfill({ json: { ...payload, habits: [] } }),
  );
  await page.goto('/habit-tracker');
  await expect(page.getByText('No resolutions for this week.')).toHaveCount(2);
  await page.unroute('**/habits/data*');
  await page.route('**/habits/data*', (route) =>
    route.fulfill({ status: 503, json: { error: 'Offline' } }),
  );
  await page.reload();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Could not load or save the tracker.' }),
  ).toContainText('Could not load or save the tracker.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Function: HabitCommentDonation — signed-in visitors can request a comment donation and close the invoice', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('21gifts.session', 'habit-e2e'));
  await page.route(/\/me$/, (route) =>
    route.fulfill({
      json: {
        id: 'donor',
        linkingKey: null,
        role: 'basis',
        name: 'Donor',
        username: 'donor',
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
        walletRequired: true,
      },
    }),
  );
  const comment = {
    id: 'comment-1',
    accountId: 'recipient',
    name: 'Recipient',
    text: 'Thanks for sharing',
    week: payload.week.start,
    createdAt: 1790899200000,
    canReceiveDonation: true,
  };
  let invoiceRequest: unknown;
  await page.route('**/habits/data*', async (route) => {
    if (route.request().method() === 'POST') {
      invoiceRequest = route.request().postDataJSON();
      await route.fulfill({ json: { pr: 'lnbc-local-test-only', amountSats: 100 } });
    } else
      await route.fulfill({ json: { ...payload, commentsAllowed: true, comments: [comment] } });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin', exact: true }).click();
  await page.getByRole('textbox', { name: 'Amount' }).fill('100');
  await page.getByRole('button', { name: 'Donate Bitcoin', exact: true }).last().click();
  await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
  expect(invoiceRequest).toEqual({ action: 'invoice', id: 'comment-1', amountSats: 100 });
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByText('Thanks for sharing')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete comment' })).toHaveCount(0);
});

test('Function: useLatestRateDayState — the donation invoice waits until the gift-day rate has settled', async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem('21gifts.session', 'habit-e2e'));
  await page.route(/\/me$/, (route) =>
    route.fulfill({
      json: {
        id: 'donor',
        linkingKey: null,
        role: 'basis',
        name: 'Donor',
        username: 'donor',
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
        walletRequired: true,
      },
    }),
  );
  const comment = {
    id: 'comment-1',
    accountId: 'recipient',
    name: 'Recipient',
    text: 'Thanks for sharing',
    week: payload.week.start,
    createdAt: 1790899200000,
    canReceiveDonation: true,
  };
  await page.route('**/habits/data*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ json: { pr: 'lnbc-local-test-only', amountSats: 100 } });
    } else
      await route.fulfill({ json: { ...payload, commentsAllowed: true, comments: [comment] } });
  });
  let releaseStats = () => undefined;
  const statsHeld = new Promise<void>((resolve) => {
    releaseStats = resolve;
  });
  await page.route('**/gifts/stats', async (route) => {
    await statsHeld;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'unavailable' }),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin', exact: true }).click();
  await page.getByRole('textbox', { name: 'Amount' }).fill('100');
  const donate = page.getByRole('button', { name: 'Donate Bitcoin', exact: true }).last();
  await expect(donate).toBeDisabled();
  releaseStats();
  await expect(donate).toBeEnabled();
  await donate.click();
  await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
});

test('Habit-Tracker — archived weeks hide the description and comment composer', async ({
  page,
}) => {
  await page.route('**/habits/data*', (route) =>
    route.fulfill({ json: { ...payload, currentWeek: '2026-10-05', commentsAllowed: false } }),
  );
  await page.goto('/habit-tracker');
  await expect(page.getByText('Read every day')).toBeVisible();
  await expect(page.getByText(/Every Monday at 08:00/)).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Write a comment' })).toHaveCount(0);
  await expect(page.getByText('Comments for this week are closed.')).toBeVisible();
});
