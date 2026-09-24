import { expect, test } from '@playwright/test';

test('same-origin api proxy routes exist', async ({ request }) => {
  expect((await request.get('/auth/lnurl')).status()).toBe(404);
  expect((await request.get('/auth/session')).status()).toBe(404);
  expect((await request.get('/me')).status()).toBe(401);
  expect((await request.get('/pos/charge')).status()).toBe(401);
  expect((await request.post('/pos/charge')).status()).toBe(401);
  expect((await request.delete('/pos/charge')).status()).toBe(401);
  expect((await request.get('/push/vapid-public')).status()).toBe(401);
  expect((await request.post('/me/push-subscriptions')).status()).toBe(401);
  expect((await request.delete('/me/push-subscriptions')).status()).toBe(401);
  expect((await request.get('/forum/messages')).status()).toBe(401);
  expect((await request.get('/forum/messages/hidden')).status()).toBe(401);
  expect((await request.post('/forum/messages')).status()).toBe(401);
  expect((await request.get('/forum/messages/[id]')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get('/forum/messages/[id]/replies')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get('/public-messages/[id]')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get('/public-messages/[id]/replies')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get('/links/[code]')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get('/l/[code]')).status()).toBe(404);
  expect((await request.post('/messages/[id]/invoice')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.post('/contact/submit')).status()).toBe(401);
  expect((await request.get('/conversations')).status()).toBe(401);
  expect((await request.post('/conversations')).status()).toBe(401);
  expect((await request.get('/conversations/[id]')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.post('/conversations/[id]')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.post('/conversations/[id]/invoice')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.post('/conversations/[id]/read')).status()).toBeGreaterThanOrEqual(400);
  expect(
    (await request.get('/conversations/[id]/messages/[messageId]/photo')).status(),
  ).toBeGreaterThanOrEqual(400);
  expect(
    (await request.get('/conversations/[id]/messages/[messageId]/photo/[file]')).status(),
  ).toBeGreaterThanOrEqual(400);
  expect(
    (await request.get('/conversations/c1/messages/m1/photo')).status(),
  ).toBeGreaterThanOrEqual(400);
  expect(
    (await request.get('/conversations/c1/messages/m1/photo/1.jpg')).status(),
  ).toBeGreaterThanOrEqual(400);
  expect((await request.get('/conversations/c1/messages/m1/photo/0.jpg')).status()).toBe(404);
  expect((await request.get('/forum/notifications')).status()).toBe(401);
  expect((await request.post('/forum/notifications/read-all')).status()).toBe(401);
  expect((await request.post('/forum/notifications/[id]/read')).status()).toBeGreaterThanOrEqual(
    400,
  );
  expect((await request.get('/messages/[id]/photo')).status()).toBe(404);
  expect((await request.get('/messages/m1/photo')).status()).toBe(404);
  expect((await request.get('/messages/[id]/photo/[file]')).status()).toBe(404);
  expect((await request.get('/messages/m1/photo/1.jpg')).status()).toBe(404);
  expect((await request.get('/messages/[id]/[file]')).status()).toBe(404);
  expect((await request.get('/messages/m1/video.mp4')).status()).toBe(404);
  expect((await request.post('/me/name')).status()).toBe(401);
  expect((await request.post('/me/username')).status()).toBe(401);
  expect((await request.post('/me/location')).status()).toBe(401);
  expect((await request.post('/me/notification-level')).status()).toBe(401);
  expect((await request.post('/me/amount-unit')).status()).toBe(401);
  expect((await request.put('/me/about')).status()).toBe(401);
  expect((await request.get('/me/about/photo')).status()).toBe(401);
  expect((await request.post('/me/rules-agreement')).status()).toBe(401);
  expect((await request.post('/me/lightning-address')).status()).toBe(401);
  expect((await request.delete('/me/lightning-address')).status()).toBe(401);
  expect((await request.get('/lightning-address')).status()).toBe(400);
  expect((await request.get('/gifts/stats')).status()).toBe(200);
  expect((await request.get('/me/activity')).status()).toBe(401);
  expect(
    (await request.get('/forum/members/[accountId]/activity')).status(),
  ).toBeGreaterThanOrEqual(400);
  expect((await request.get('/view-key/[viewKey]/activity')).status()).toBe(200);
  expect((await request.get('/trust/graph')).status()).toBe(401);
  expect((await request.get('/trust/proposals')).status()).toBe(401);
  expect((await request.post('/trust/verify')).status()).toBe(401);
  expect((await request.post('/trust/propose-moderator')).status()).toBe(401);
  expect((await request.post('/trust/confirm-moderator')).status()).toBe(401);
  expect((await request.post('/trust/reject-moderator')).status()).toBe(401);
  expect((await request.post('/trust/appoint-moderator')).status()).toBe(401);
  expect((await request.post('/funding/apply')).status()).toBe(401);
  expect((await request.get('/funding/applications')).status()).toBe(401);
  expect((await request.get('/funding/applications/[accountId]')).status()).toBeGreaterThanOrEqual(
    400,
  );
  expect((await request.post('/funding/trial')).status()).toBe(401);
  expect((await request.post('/funding/admit')).status()).toBe(401);
  expect((await request.post('/funding/reject')).status()).toBe(401);
  expect((await request.get('/gifts')).status()).toBe(400);
  expect((await request.post('/auth/passkey/register/begin')).status()).toBe(200);
  expect((await request.post('/auth/passkey/register/finish')).status()).toBe(400);
  expect((await request.post('/auth/passkey/authenticate/begin')).status()).toBe(200);
  expect((await request.post('/auth/passkey/authenticate/finish')).status()).toBe(400);
  expect((await request.post('/auth/passkey/replace/begin')).status()).toBe(401);
  expect((await request.post('/auth/passkey/replace/finish')).status()).toBe(401);
  expect((await request.post('/me/wallet-backup-seen')).status()).toBe(401);
  expect((await request.get('/view-key/[viewKey]')).status()).toBeGreaterThanOrEqual(400);
  expect((await request.get('/view-key/[viewKey]/about/photo')).status()).toBeGreaterThanOrEqual(
    400,
  );
  expect((await request.get(`/view-key/${'a'.repeat(64)}`)).status()).toBe(404);
});
