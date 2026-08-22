import { expect, test } from '@playwright/test';

test('landing page renders the wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('healthz returns ok', async ({ request }) => {
  const res = await request.get('/healthz');

  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('favicon.ico is served as an image', async ({ request }) => {
  const res = await request.get('/favicon.ico');

  expect(res.status()).toBe(200);
  expect(res.headers()['content-type'] ?? '').toMatch(/image\//);
});

test('favicon.svg is served as svg', async ({ request }) => {
  const res = await request.get('/favicon.svg');

  expect(res.status()).toBe(200);
  expect(res.headers()['content-type'] ?? '').toMatch(/image\/svg\+xml|svg/);
});

test('apple-touch-icon.png is served as png', async ({ request }) => {
  const res = await request.get('/apple-touch-icon.png');

  expect(res.status()).toBe(200);
  expect(res.headers()['content-type'] ?? '').toMatch(/image\/png/);
});

test('og.png is served as png', async ({ request }) => {
  const res = await request.get('/og.png');

  expect(res.status()).toBe(200);
  expect(res.headers()['content-type'] ?? '').toMatch(/image\/png/);
});
