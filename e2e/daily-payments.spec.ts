import { expect, test, type Page, type Route } from '@playwright/test';

const ROSTER = {
  comment: 'Daily gift',
  paymentsEnabled: true,
  defaultAmountUsd: 1,
  recipients: [
    { address: 'ada@walletofsatoshi.com', amountUsd: 1, accountId: 'acc_ada', name: 'Ada' },
    { address: 'bob@example.com', amountUsd: 0.3, accountId: null, name: null },
  ],
  moderatorPaymentsEnabled: true,
  moderators: [
    { address: 'ada@walletofsatoshi.com', amountUsd: 1, accountId: 'acc_ada', name: 'Ada' },
    { address: 'bob@example.com', amountUsd: 0.3, accountId: null, name: null },
  ],
};

const EMPTY_ROSTER = {
  comment: '',
  paymentsEnabled: true,
  defaultAmountUsd: 1,
  recipients: [] as Array<{
    address: string;
    amountUsd: number;
    accountId: string | null;
    name: string | null;
  }>,
  moderatorPaymentsEnabled: true,
  moderators: [] as Array<{
    address: string;
    amountUsd: number;
    accountId: string | null;
    name: string | null;
  }>,
};

async function seedAdaSession(
  page: Page,
  role: 'basis' | 'verified' | 'moderator' | 'initiator' | 'founder' = 'basis',
): Promise<void> {
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
        role,
        name: 'Ada',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        setup: null,
        missing: [],
        funding:
          role === 'basis'
            ? null
            : {
                status: 'none',
                trialUtcDate: null,
                admittedAt: null,
                reviewedByName: null,
              },
      }),
    });
  });
}

async function stubApplications(page: Page): Promise<void> {
  await page.route(/\/funding\/applications$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ applications: [] }),
    });
  });
}

async function fulfillRoster(route: Route, body: unknown): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

test('Function: canEditDailyPayoutRoster — initiator sees both daily links and a moderator does not', async ({
  page,
}) => {
  await seedAdaSession(page, 'initiator');
  await stubApplications(page);
  await page.goto('/grants');
  await expect(page.getByRole('link', { name: 'Daily payment text' })).toHaveAttribute(
    'href',
    '/grants/payments/comment',
  );
  await expect(page.getByRole('link', { name: 'Daily payment amounts' })).toHaveAttribute(
    'href',
    '/grants/payments/amounts',
  );
  await expect(page.getByRole('link', { name: 'Moderator payments' })).toHaveAttribute(
    'href',
    '/grants/payments/moderators',
  );
  await seedAdaSession(page, 'moderator');
  await page.goto('/grants');
  await expect(page.getByRole('link', { name: 'Daily payment text' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Daily payment amounts' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Moderator payments' })).toHaveCount(0);
  await expect(page.getByText('No open applications.')).toBeVisible();
});

test('verified and basis grants pages have no daily payment links', async ({ page }) => {
  await seedAdaSession(page, 'verified');
  await page.goto('/grants');
  await expect(page.getByRole('link', { name: 'Daily payment text' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Daily payment amounts' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Moderator payments' })).toHaveCount(0);
  await seedAdaSession(page, 'basis');
  await page.goto('/grants');
  await expect(page.getByRole('link', { name: 'Daily payment text' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Daily payment amounts' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Moderator payments' })).toHaveCount(0);
});

test('signed-out grants page has no daily payment links', async ({ page }) => {
  await page.goto('/grants');
  await expect(page.getByRole('link', { name: 'Daily payment text' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Daily payment amounts' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Moderator payments' })).toHaveCount(0);
});

test('Function: DailyPaymentCommentPage — the comment route shows only the text', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.goto('/grants/payments/comment');
  await expect(page.getByRole('heading', { name: 'Daily payment text' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'On' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ada' })).toHaveCount(0);
  await expect(page.getByText('Unnamed')).toHaveCount(0);
  await expect(page.getByText('ada@w...')).toHaveCount(0);
  await expect(page.getByText('ada@walletofsatoshi.com')).toHaveCount(0);
  await expect(page.getByText('bob@example.com')).toHaveCount(0);
});

test('Function: DailyPaymentCommentScreen — a moderator on the comment URL does not load the roster', async ({
  page,
}) => {
  let rosterGets = 0;
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/funding/daily-roster') {
      rosterGets += 1;
    }
  });
  await seedAdaSession(page, 'moderator');
  await page.goto('/grants/payments/comment');
  await expect(page.getByRole('heading', { name: 'Daily payment text' })).toBeVisible();
  await expect(page.getByText('You cannot change daily payments.')).toBeVisible();
  expect(rosterGets).toBe(0);
});

test('Function: DailyPaymentAmountsScreen — a moderator on the amounts URL does not load the roster', async ({
  page,
}) => {
  let rosterGets = 0;
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/funding/daily-roster') {
      rosterGets += 1;
    }
  });
  await seedAdaSession(page, 'moderator');
  await page.goto('/grants/payments/amounts');
  await expect(page.getByRole('heading', { name: 'Daily payment amounts' })).toBeVisible();
  await expect(page.getByText('You cannot change daily payments.')).toBeVisible();
  expect(rosterGets).toBe(0);
});

test('Function: DailyPaymentAmountsPage — founder opens /grants/payments/amounts', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.goto('/grants/payments/amounts');
  await expect(page.getByRole('heading', { name: 'Daily payment amounts' })).toBeVisible();
  await expect(
    page.getByText('Everyone in the grant program receives $1.00 by default.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/members/acc_ada');
  await expect(page.getByText('Unnamed')).toBeVisible();
  await expect(page.getByText('ada@w...')).toHaveCount(0);
  await expect(page.getByText('ada@walletofsatoshi.com')).toHaveCount(0);
  await expect(page.getByText('bob@example.com')).toHaveCount(0);
  await expect(page.getByText('Daily gift')).toHaveCount(0);
});

test('Function: fetchDailyRoster — an initiator loads the roster', async ({ page }) => {
  await seedAdaSession(page, 'initiator');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await fulfillRoster(route, ROSTER);
  });
  await page.goto('/grants/payments/comment');
  await expect(page.getByText('Daily gift')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit comment' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ada' })).toHaveCount(0);
  await expect(page.getByText('Unnamed')).toHaveCount(0);
  await expect(page.getByText('ada@w...')).toHaveCount(0);
  await expect(page.getByText('ada@walletofsatoshi.com')).toHaveCount(0);
  await expect(page.getByText('bob@example.com')).toHaveCount(0);
});

test('Function: saveDailyRosterComment — Save posts the comment JSON', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/comment$/, async (route) => {
    const body = route.request().postDataJSON() as { comment: string };
    await fulfillRoster(route, { ...ROSTER, comment: body.comment });
  });
  await page.goto('/grants/payments/comment');
  await page.getByRole('button', { name: 'Edit comment' }).click();
  await page.getByLabel('Comment').fill('Hello from grants');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' && new URL(req.url()).pathname === '/funding/daily-roster/comment',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await posted).postDataJSON()).toEqual({ comment: 'Hello from grants' });
  await expect(page.getByText('Hello from grants')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit comment' })).toBeVisible();
});

test('Function: saveDailyRosterPayments — Off posts enabled false', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/payments$/, async (route) => {
    await fulfillRoster(route, { ...ROSTER, paymentsEnabled: false });
  });
  await page.goto('/grants/payments/amounts');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' && new URL(req.url()).pathname === '/funding/daily-roster/payments',
  );
  await page.getByRole('button', { name: 'Off' }).click();
  expect((await posted).postDataJSON()).toEqual({ enabled: false });
  await expect(page.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
});

test('state-grants-payments-comment-empty — Not set', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, EMPTY_ROSTER);
  });
  await page.goto('/grants/payments/comment');
  await expect(page.getByText('Not set')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit comment' })).toBeVisible();
});

test('state-grants-payments-amounts-empty — No recipients', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, EMPTY_ROSTER);
  });
  await page.goto('/grants/payments/amounts');
  await expect(page.getByText('No recipients')).toBeVisible();
});

test('state-grants-payments-amounts-loading — the roster request stays open', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, () => new Promise(() => undefined));
  await page.goto('/grants/payments/amounts');
  await expect(page.getByText('Loading…')).toBeVisible();
  await expect(page.getByText('state-grants-payments-amounts-loading')).toHaveCount(0);
});

test('state-grants-payments-amounts-error — Could not load daily payments. Please try again.', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/grants/payments/amounts');
  await expect(page.getByText('Could not load daily payments. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Function: addDailyRosterRecipient — Add posts account id and amount', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/forum\/mentions/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts: [{ id: 'acc_ada', username: 'ada', name: 'Ada' }] }),
    });
  });
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, EMPTY_ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/recipients$/, async (route) => {
    const body = route.request().postDataJSON() as { accountId: string; amountUsd: number };
    await fulfillRoster(route, {
      ...EMPTY_ROSTER,
      recipients: [
        {
          address: 'ada@example.com',
          amountUsd: body.amountUsd,
          accountId: body.accountId,
          name: 'Ada',
        },
      ],
    });
  });
  await page.goto('/grants/payments/amounts');
  await page.getByRole('textbox', { name: 'Person' }).fill('@');
  await page.getByRole('option', { name: '@ada' }).click();
  await page.getByLabel('USD').fill('1.5');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' && new URL(req.url()).pathname === '/funding/daily-roster/recipients',
  );
  await page.getByRole('button', { name: 'Add' }).click();
  expect((await posted).postDataJSON()).toEqual({ accountId: 'acc_ada', amountUsd: 1.5 });
  await expect(page.getByText('ada@example.com')).toHaveCount(0);
});

test('Function: updateDailyRosterRecipient — Update posts the stored address', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/recipients\/update$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.goto('/grants/payments/amounts');
  await page.getByRole('button', { name: 'Edit Ada' }).click();
  await page.getByRole('textbox', { name: 'USD Ada' }).fill('2');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' &&
      new URL(req.url()).pathname === '/funding/daily-roster/recipients/update',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await posted).postDataJSON()).toEqual({
    address: 'ada@walletofsatoshi.com',
    amountUsd: 2,
  });
});

test('Function: deleteDailyRosterRecipient — Delete posts the stored address', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/recipients\/delete$/, async (route) => {
    await fulfillRoster(route, {
      ...ROSTER,
      recipients: ROSTER.recipients.filter((row) => row.address !== 'bob@example.com'),
    });
  });
  await page.goto('/grants/payments/amounts');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' &&
      new URL(req.url()).pathname === '/funding/daily-roster/recipients/delete',
  );
  await page.getByRole('button', { name: 'Delete Unnamed' }).click();
  expect((await posted).postDataJSON()).toEqual({ address: 'bob@example.com' });
  await expect(page.getByText('Unnamed')).toHaveCount(0);
  await expect(page.getByText('bob@example.com')).toHaveCount(0);
});

test('Function: proxyFundingDailyRosterGet — GET /funding/daily-roster without bearer is 401', async ({
  request,
}) => {
  expect((await request.get('/funding/daily-roster')).status()).toBe(401);
});

test('Function: proxyFundingDailyRosterCommentPost — POST /funding/daily-roster/comment without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/comment')).status()).toBe(401);
});

test('Function: proxyFundingDailyRosterPaymentsPost — POST /funding/daily-roster/payments without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/payments')).status()).toBe(401);
});

test('Function: proxyFundingDailyRosterRecipientsPost — POST /funding/daily-roster/recipients without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/recipients')).status()).toBe(401);
});

test('Function: proxyFundingDailyRosterRecipientsUpdatePost — POST /funding/daily-roster/recipients/update without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/recipients/update')).status()).toBe(401);
});

test('Function: proxyFundingDailyRosterRecipientsDeletePost — POST /funding/daily-roster/recipients/delete without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/recipients/delete')).status()).toBe(401);
});

test('Function: DailyPaymentModeratorsScreen — a moderator on the moderators URL does not load the roster', async ({
  page,
}) => {
  let rosterGets = 0;
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/funding/daily-roster') {
      rosterGets += 1;
    }
  });
  await seedAdaSession(page, 'moderator');
  await page.goto('/grants/payments/moderators');
  await expect(page.getByRole('heading', { name: 'Moderator payments' })).toBeVisible();
  await expect(page.getByText('You cannot change daily payments.')).toBeVisible();
  expect(rosterGets).toBe(0);
});

test('Function: DailyPaymentModeratorsPage — founder opens /grants/payments/moderators', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.goto('/grants/payments/moderators');
  await expect(page.getByRole('heading', { name: 'Moderator payments' })).toBeVisible();
  await expect(page.getByText('Moderators')).toBeVisible();
  await expect(page.getByText('Everyone in the grant program receives')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ada' })).toHaveAttribute('href', '/members/acc_ada');
  await expect(page.getByText('Unnamed')).toBeVisible();
  await expect(page.getByText('ada@w...')).toHaveCount(0);
  await expect(page.getByText('ada@walletofsatoshi.com')).toHaveCount(0);
  await expect(page.getByText('bob@example.com')).toHaveCount(0);
  await expect(page.getByText('Daily gift')).toHaveCount(0);
});

test('Function: saveDailyRosterModeratorPayments — Off posts enabled false', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/moderators\/payments$/, async (route) => {
    await fulfillRoster(route, { ...ROSTER, moderatorPaymentsEnabled: false });
  });
  await page.goto('/grants/payments/moderators');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' &&
      new URL(req.url()).pathname === '/funding/daily-roster/moderators/payments',
  );
  await page.getByRole('button', { name: 'Off' }).click();
  expect((await posted).postDataJSON()).toEqual({ enabled: false });
  await expect(page.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
});

test('state-grants-payments-moderators-empty — No moderators', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, EMPTY_ROSTER);
  });
  await page.goto('/grants/payments/moderators');
  await expect(page.getByText('No moderators')).toBeVisible();
});

test('state-grants-payments-moderators-loading — the roster request stays open', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, () => new Promise(() => undefined));
  await page.goto('/grants/payments/moderators');
  await expect(page.getByText('Loading…')).toBeVisible();
  await expect(page.getByText('state-grants-payments-moderators-loading')).toHaveCount(0);
});

test('state-grants-payments-moderators-error — Could not load daily payments. Please try again.', async ({
  page,
}) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/grants/payments/moderators');
  await expect(page.getByText('Could not load daily payments. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});

test('Function: addDailyRosterModerator — Add posts account id and amount', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/forum\/mentions/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ accounts: [{ id: 'acc_ada', username: 'ada', name: 'Ada' }] }),
    });
  });
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, EMPTY_ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/moderators$/, async (route) => {
    const body = route.request().postDataJSON() as { accountId: string; amountUsd: number };
    await fulfillRoster(route, {
      ...EMPTY_ROSTER,
      moderators: [
        {
          address: 'ada@example.com',
          amountUsd: body.amountUsd,
          accountId: body.accountId,
          name: 'Ada',
        },
      ],
    });
  });
  await page.goto('/grants/payments/moderators');
  await page.getByRole('textbox', { name: 'Person' }).fill('@');
  await page.getByRole('option', { name: '@ada' }).click();
  await page.getByLabel('USD').fill('1.5');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' && new URL(req.url()).pathname === '/funding/daily-roster/moderators',
  );
  await page.getByRole('button', { name: 'Add' }).click();
  expect((await posted).postDataJSON()).toEqual({ accountId: 'acc_ada', amountUsd: 1.5 });
  await expect(page.getByText('ada@example.com')).toHaveCount(0);
});

test('Function: updateDailyRosterModerator — Update posts the stored address', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/moderators\/update$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.goto('/grants/payments/moderators');
  await page.getByRole('button', { name: 'Edit Ada' }).click();
  await page.getByRole('textbox', { name: 'USD Ada' }).fill('2');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' &&
      new URL(req.url()).pathname === '/funding/daily-roster/moderators/update',
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await posted).postDataJSON()).toEqual({
    address: 'ada@walletofsatoshi.com',
    amountUsd: 2,
  });
});

test('Function: deleteDailyRosterModerator — Delete posts the stored address', async ({ page }) => {
  await seedAdaSession(page, 'founder');
  await page.route(/\/funding\/daily-roster$/, async (route) => {
    await fulfillRoster(route, ROSTER);
  });
  await page.route(/\/funding\/daily-roster\/moderators\/delete$/, async (route) => {
    await fulfillRoster(route, {
      ...ROSTER,
      moderators: ROSTER.moderators.filter((row) => row.address !== 'bob@example.com'),
    });
  });
  await page.goto('/grants/payments/moderators');
  const posted = page.waitForRequest(
    (req) =>
      req.method() === 'POST' &&
      new URL(req.url()).pathname === '/funding/daily-roster/moderators/delete',
  );
  await page.getByRole('button', { name: 'Delete Unnamed' }).click();
  expect((await posted).postDataJSON()).toEqual({ address: 'bob@example.com' });
  await expect(page.getByText('Unnamed')).toHaveCount(0);
  await expect(page.getByText('bob@example.com')).toHaveCount(0);
});

test('Function: proxyFundingDailyRosterModeratorsPost — POST /funding/daily-roster/moderators without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/moderators')).status()).toBe(401);
});

test('Function: proxyFundingDailyRosterModeratorsUpdatePost — POST /funding/daily-roster/moderators/update without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/moderators/update')).status()).toBe(401);
});

test('Function: proxyFundingDailyRosterModeratorsDeletePost — POST /funding/daily-roster/moderators/delete without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/moderators/delete')).status()).toBe(401);
});

test('Function: proxyFundingDailyRosterModeratorsPaymentsPost — POST /funding/daily-roster/moderators/payments without bearer is 401', async ({
  request,
}) => {
  expect((await request.post('/funding/daily-roster/moderators/payments')).status()).toBe(401);
});
