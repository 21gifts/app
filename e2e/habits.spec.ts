import { expect, test, type Page } from '@playwright/test';

const PUBLIC_HABIT = {
  id: 'h-ada',
  accountId: 'acc-ada',
  ownerName: 'Ada',
  role: 'initiator',
  name: 'Walk',
  description: 'Outside',
  cadence: 'daily',
  timeZone: 'Asia/Manila',
  firstPeriod: '2026-10-01',
  lastPeriod: null,
  periods: [
    {
      period: '2026-10-04',
      name: 'Walk',
      description: 'Outside',
      logged: false,
      status: null,
    },
  ],
  comments: [
    {
      id: 'c-bea',
      habitId: 'h-ada',
      accountId: 'acc-bea',
      name: 'Bea',
      text: 'hello',
      week: '2026-09-28',
      createdAt: 1,
    },
  ],
};

const PUBLIC_LIST = {
  reviewWeek: { start: '2026-09-28' },
  habits: [PUBLIC_HABIT],
};

async function stubHabits(page: Page, body: unknown): Promise<void> {
  await page.route('**/habits', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function seedAda(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('21gifts.session', 'sess-e2e');
  });
  await page.route('**/gifts/stats**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"spendOverTime":[]}',
    });
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
        lightningAddress: 'alice@walletofsatoshi.com',
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

test('screen /habit-tracker default', async ({ page }) => {
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await expect(page.getByRole('heading', { name: 'Habit-Tracker' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ada' })).toBeVisible();
  await expect(page.getByText('Outside')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in to comment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Achieved' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send Bitcoin' })).toHaveCount(0);
});

test('screen /habit-tracker empty', async ({ page }) => {
  await stubHabits(page, {
    reviewWeek: { start: '2026-09-28' },
    habits: [],
  });
  await page.goto('/habit-tracker');
  await expect(page.getByText('No habits yet.')).toBeVisible();
  await expect(page.getByText(/A week can be rated from Monday 08:00/)).toBeVisible();
  await expect(page.getByText(/Monday at 16:00/)).toHaveCount(0);
});

test('screen /habit-tracker loading', async ({ page }) => {
  await page.route('**/habits', () => new Promise(() => undefined));
  await page.goto('/habit-tracker');
  await expect(page.getByText('Loading…')).toBeVisible();
});

test('screen /habit-tracker error', async ({ page }) => {
  await page.route('**/habits', async (route) => {
    await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
  });
  await page.goto('/habit-tracker');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(
    page.getByText('Could not load or save the tracker. Please try again.'),
  ).toBeVisible();
});

test('screen /habit-tracker signed-in', async ({ page }) => {
  await seedAda(page);
  await stubHabits(page, {
    reviewWeek: PUBLIC_LIST.reviewWeek,
    habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
  });
  await page.goto('/habit-tracker');
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  await expect(page.getByText('Internal notes:')).toBeVisible();
  await expect(page.getByText('secret')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Achieved', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add habit' })).toBeVisible();
});

test('screen /habit-tracker donate', async ({ page }) => {
  await seedAda(page);
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await expect(page.getByLabel('Amount')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('screen /habit-tracker donate-invoice', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pr: 'lnbc1', amountSats: 21 }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_LIST),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
});

test('Function: ForumPaySheet — a habit comment uses the forum pay sheet', async ({ page }) => {
  await seedAda(page);
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pr: 'lnbc1', amountSats: 21 }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_LIST),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Send Bitcoin' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Pay ₿21')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeVisible();
});

test('Function: HabitTrackerPage — a signed-out visitor reads the public list', async ({
  page,
}) => {
  await stubHabits(page, PUBLIC_LIST);
  await page.goto('/habit-tracker');
  await expect(page.getByRole('heading', { name: 'Habit-Tracker' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('Function: MemberHabits — the owner logs the open period', async ({ page }) => {
  await seedAda(page);
  let posted = '';
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      posted = route.request().postData() ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        reviewWeek: PUBLIC_LIST.reviewWeek,
        habits: [{ ...PUBLIC_HABIT, accountId: 'acc_e2e', notes: 'secret' }],
      }),
    });
  });
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Achieved', exact: true }).click();
  await expect.poll(() => posted).toContain('"status":"achieved"');
});

test('Function: fetchMemberHabits — GET /habits is public', async ({ request }) => {
  const response = await request.get('/habits');
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { habits: Array<{ name: string }> };
  expect(body.habits[0]?.name).toBe('Walk');
});

test('Function: postMemberHabit — POST /habits without a session is unauthorized', async ({
  request,
}) => {
  const response = await request.post('/habits', { data: { action: 'add', name: 'Walk' } });
  expect(response.status()).toBe(401);
});
