import { expect, test } from '@playwright/test';

test('landing page renders the wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '21.gifts' })).toBeVisible();
});

test('healthz returns ok', async ({ request }) => {
  const res = await request.get('/healthz');

  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});
