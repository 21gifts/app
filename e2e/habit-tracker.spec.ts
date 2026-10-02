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
  await expect(page.getByRole('alert')).toContainText('Could not load or save the tracker.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
