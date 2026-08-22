import { expect, test } from '@playwright/test';

test('same-origin api proxy routes exist', async ({ request }) => {
  expect((await request.get('/auth/lnurl')).status()).not.toBe(404);
  expect((await request.get('/auth/lnurl/callback')).status()).not.toBe(404);
  expect((await request.get('/auth/session')).status()).not.toBe(404);
  expect((await request.get('/me')).status()).not.toBe(404);
  expect((await request.post('/me/lightning-address')).status()).not.toBe(404);
  expect((await request.delete('/me/lightning-address')).status()).not.toBe(404);
  expect((await request.post('/me/lightning-address/verification')).status()).not.toBe(404);
  expect((await request.post('/me/lightning-address/verification/confirm')).status()).not.toBe(404);
  expect((await request.get('/lightning-address')).status()).not.toBe(404);
});
