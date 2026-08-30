import { expect, test } from '@playwright/test';

const ID = '11111111-1111-4111-8111-111111111111';

const PUBLIC_NOTE = {
  id: ID,
  name: 'Ada',
  text: 'Hello from Ada',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 0,
  payable: false,
  hasPhoto: false,
  role: 'basis',
  replyCount: 0,
};

test('e2e:check dynamic path token for /messages/[id]', async ({ page }) => {
  await page.goto('/messages/[id]');
});

test('public message default shows Hello from Ada', async ({ page }) => {
  await page.route(`**/public-messages/${ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(PUBLIC_NOTE),
    });
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByText('Hello from Ada')).toBeVisible();
  await expect(page.getByText('Ada')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('public message missing shows not-found copy', async ({ page }) => {
  await page.goto('/messages/not-a-uuid');
  await expect(page.getByText('This profile could not be found.')).toBeVisible();
});

test('public message loading shows Loading…', async ({ page }) => {
  await page.route(`**/public-messages/${ID}`, async () => {
    // never fulfill
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByText('Loading…')).toBeVisible();
});

test('public message error shows Try again', async ({ page }) => {
  await page.route(`**/public-messages/${ID}`, async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'boom' }),
    });
  });
  await page.goto(`/messages/${ID}`);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
});
