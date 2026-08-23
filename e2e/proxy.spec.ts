import { expect, test } from '@playwright/test';

test('same-origin api proxy routes exist', async ({ request }) => {
  expect((await request.get('/auth/lnurl')).status()).toBe(502);
  expect((await request.get('/auth/lnurl/callback')).status()).toBe(502);
  expect((await request.get('/auth/session')).status()).toBe(502);
  expect((await request.get('/me')).status()).toBe(502);
  expect((await request.post('/me/name')).status()).toBe(502);
  expect((await request.post('/me/lightning-address')).status()).toBe(502);
  expect((await request.delete('/me/lightning-address')).status()).toBe(502);
  expect((await request.get('/lightning-address')).status()).toBe(502);
});
