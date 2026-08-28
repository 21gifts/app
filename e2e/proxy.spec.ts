import { expect, test } from '@playwright/test';

test('same-origin api proxy routes exist', async ({ request }) => {
  expect((await request.get('/auth/lnurl')).status()).toBe(404);
  expect((await request.get('/auth/session')).status()).toBe(404);
  expect((await request.get('/me')).status()).toBe(401);
  expect((await request.get('/messages')).status()).toBe(401);
  expect((await request.post('/messages')).status()).toBe(401);
  expect((await request.post('/messages/[id]/invoice')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.post('/contact/submit')).status()).toBe(401);
  expect((await request.get('/messages/[id]/photo')).status()).toBe(401);
  expect((await request.get('/messages/m1/photo')).status()).toBe(401);
  expect((await request.post('/me/name')).status()).toBe(401);
  expect((await request.post('/me/lightning-address')).status()).toBe(401);
  expect((await request.delete('/me/lightning-address')).status()).toBe(401);
  expect((await request.get('/lightning-address')).status()).toBe(400);
  expect((await request.get('/gifts/stats')).status()).toBe(200);
  expect((await request.get('/gifts')).status()).toBe(400);
  expect((await request.post('/auth/passkey/register/begin')).status()).toBe(200);
  expect((await request.post('/auth/passkey/register/finish')).status()).toBe(400);
  expect((await request.post('/auth/passkey/authenticate/begin')).status()).toBe(200);
  expect((await request.post('/auth/passkey/authenticate/finish')).status()).toBe(400);
});
