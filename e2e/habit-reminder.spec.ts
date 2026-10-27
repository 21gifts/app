import { expect, test, type Page } from '@playwright/test';

const habit = {
  id: 'h-ada',
  accountId: 'acc_e2e',
  ownerName: 'Ada',
  role: 'basis',
  name: 'Walk',
  description: 'Outside',
  cadence: 'daily',
  timeZone: 'Asia/Manila',
  firstPeriod: '2026-10-01',
  lastPeriod: null,
  comments: [],
  periods: Array.from({ length: 12 }, (_, i) => ({
    period: `2026-10-${String(i + 1).padStart(2, '0')}`,
    name: 'Walk',
    description: 'Outside',
    logged: i !== 0,
    status: i === 0 ? null : 'achieved',
  })),
};

async function seed(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('21gifts.session', 'sess-e2e'));
  await page.route(/\/me$/, async (route) =>
    route.fulfill({
      json: {
        id: 'acc_e2e',
        linkingKey: `02${'a'.repeat(62)}`,
        role: 'basis',
        name: 'Ada',
        username: 'alice',
        location: null,
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: true,
        forumLawsDismissed: true,
        createdAt: 1,
        rulesAgreedAt: 1,
        viewKey: 'a'.repeat(64),
        aboutMe: null,
        aboutMeHasPhoto: false,
        setup: null,
        missing: [],
        hasPosted: true,
      },
    }),
  );
  await page.route('**/gifts/stats**', async (route) =>
    route.fulfill({ json: { spendOverTime: [] } }),
  );
}

test('Function: HabitReminder — Later defers until reopening; Rate now opens older pending ratings', async ({
  page,
}) => {
  await seed(page);
  let rated = false;
  const posts: unknown[] = [];
  await page.route('**/habits', async (route) => {
    if (route.request().method() === 'POST') {
      posts.push(route.request().postDataJSON());
      rated = true;
      await route.fulfill({ json: { ok: true } });
      return;
    }
    await route.fulfill({
      json: {
        reviewWeek: { start: '2026-10-05' },
        habits: [
          {
            ...habit,
            periods: habit.periods.map((period) =>
              rated ? { ...period, logged: true, status: 'achieved' } : period,
            ),
          },
        ],
      },
    });
  });
  await page.goto('/habit-tracker');
  const reminder = page.getByRole('dialog', { name: 'A moment for your habits' });
  await expect(reminder).toBeVisible();
  await reminder.getByRole('button', { name: 'Later' }).click();
  await expect(reminder).toHaveCount(0);
  await page.getByRole('button', { name: 'Ada', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Walk', exact: true })).toBeVisible();
  await expect(reminder).toHaveCount(0);
  await page.reload();
  await reminder.getByRole('button', { name: 'Rate now' }).click();
  await expect(page).toHaveURL(/habit-tracker\?review=1/);
  const history = page.getByRole('dialog', { name: 'Walk: All ratings' });
  await expect(history).toBeVisible();
  const old = history.getByRole('listitem').filter({ hasText: '2026-10-01' });
  await old.getByRole('button', { name: 'Achieved', exact: true }).click();
  await expect(old.getByRole('button', { name: 'Achieved', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(posts).toEqual([{ action: 'log', id: 'h-ada', period: '2026-10-01', status: 'achieved' }]);
  await page.keyboard.press('Escape');
  await expect(history).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ada', exact: true })).toBeVisible();
  await expect(reminder).toHaveCount(0);
});

test('Function: HabitPeriods — ten rows, scrollable full history, keyboard close, next tracker stays near', async ({
  page,
}) => {
  await page.route('**/habits', async (route) =>
    route.fulfill({
      json: {
        reviewWeek: { start: '2026-10-05' },
        habits: [habit, { ...habit, id: 'h2', name: 'Read', periods: [] }],
      },
    }),
  );
  await page.goto('/habit-tracker');
  await page.getByRole('button', { name: 'Ada', exact: true }).click();
  const tracker = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: 'Walk', exact: true }) });
  await expect(tracker.getByRole('listitem')).toHaveCount(10);
  await expect(page.getByRole('heading', { name: 'Read', exact: true })).toBeVisible();
  await tracker.getByRole('button', { name: 'All ratings' }).click();
  const history = page.getByRole('dialog');
  await expect(history.getByRole('listitem')).toHaveCount(12);
  await history.getByText('2026-10-01').scrollIntoViewIfNeeded();
  await expect(history.getByText('2026-10-01')).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(history).toHaveCount(0);
  await expect(tracker.getByRole('button', { name: 'All ratings' })).toBeFocused();
  await expect(tracker.getByRole('listitem')).toHaveCount(10);
});

for (const dismissal of ['Later', 'Escape'] as const) {
  test(`Function: HabitReminder — ${dismissal} restores focus after returning to the app`, async ({
    page,
  }) => {
    await seed(page);
    await page.route('**/habits', async (route) =>
      route.fulfill({ json: { reviewWeek: { start: '2026-10-05' }, habits: [habit] } }),
    );
    await page.goto('/habit-tracker');
    const reminder = page.getByRole('dialog', { name: 'A moment for your habits' });
    await reminder.getByRole('button', { name: 'Later' }).click();
    const person = page.getByRole('button', { name: 'Ada', exact: true });
    await person.focus();
    await expect(person).toBeFocused();
    await page.evaluate(() => {
      for (const state of ['hidden', 'visible']) {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
        document.dispatchEvent(new Event('visibilitychange'));
      }
    });
    await expect(reminder.getByRole('button', { name: 'Later' })).toBeFocused();
    if (dismissal === 'Escape') {
      await page.keyboard.press('Escape');
    } else {
      await reminder.getByRole('button', { name: 'Later' }).click();
    }
    await expect(reminder).toHaveCount(0);
    await expect(person).toBeFocused();
  });
}
