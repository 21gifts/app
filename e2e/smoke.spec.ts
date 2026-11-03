import http from 'node:http';
import { expect, test } from '@playwright/test';

test('unknown path shows the 404 screen', async ({ page }) => {
  await page.goto('/404');
  await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
  await expect(page.getByText('This page does not exist.')).toBeVisible();
});

test('stats nav is on the landing page', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'Stats' }),
  ).toBeVisible();
});

test('landing page renders the wordmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: '21.gifts' }).first()).toBeVisible();
});

test('healthz returns ok', async ({ request }) => {
  const res = await request.get('/healthz');

  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: 'ok' });
});

test('homepage sends HSTS', async ({ request }) => {
  const res = await request.get('/');

  expect(res.status()).toBe(200);
  expect(res.headers()['strict-transport-security']).toBe(
    'max-age=63072000; includeSubDomains; preload',
  );
});

function probe(
  port: string,
  headers: Record<string, string>,
): Promise<{ status: number; location: string | undefined }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path: '/', method: 'GET', headers },
      (res) => {
        res.resume();
        const location = res.headers.location;
        resolve({
          status: res.statusCode ?? 0,
          location: Array.isArray(location) ? location[0] : location,
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

test('http x-forwarded-proto upgrades to https://21.gifts/', async () => {
  const base = new URL(test.info().project.use.baseURL ?? 'http://127.0.0.1:3000');
  const port = base.port || '80';
  const upgraded = await probe(port, { host: '21.gifts', 'x-forwarded-proto': 'http' });
  expect(upgraded.status).toBe(308);
  expect(upgraded.location).toBe('https://21.gifts/');

  const loopback = await probe(port, { host: '127.0.0.1', 'x-forwarded-proto': 'http' });
  expect(loopback.status).toBe(200);
  const localName = await probe(port, { host: 'localhost', 'x-forwarded-proto': 'http' });
  expect(localName.status).toBe(200);
  const v6 = await probe(port, { host: `[::1]:${port}`, 'x-forwarded-proto': 'http' });
  expect(v6.status).toBe(200);
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
