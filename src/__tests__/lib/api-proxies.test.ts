// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  proxyAuthPasskeyAuthenticateBeginPost,
  proxyAuthPasskeyAuthenticateFinishPost,
  proxyAuthPasskeyRegisterBeginPost,
  proxyAuthPasskeyRegisterFinishPost,
  proxyAuthPasskeyReplaceBeginPost,
  proxyAuthPasskeyReplaceFinishPost,
  proxyMeWalletBackupSeenPost,
  proxyLightningAddressGet,
  proxyGiftsGet,
  proxyGiftsStatsGet,
  proxyMeActivityGet,
  proxyMeGet,
  proxyPosDelete,
  proxyPosGet,
  proxyPosPost,
  proxyMeForumLawsDismissedPost,
  proxyMeNotificationLevelPost,
  proxyMeLightningAddressDelete,
  proxyMeLightningAddressPost,
  proxyMeLocationPost,
  proxyMeAboutPhotoGet,
  proxyMeAboutPut,
  proxyMeNamePost,
  proxyMeUsernamePost,
  proxyMeRulesAgreementPost,
  proxyMeSetupSkipPost,
  proxyMembersActivityGet,
  proxyMembersGet,
  proxyMembersPostsGet,
  proxyMembersRepliesGet,
  proxyContactPost,
  proxyConversationGet,
  proxyConversationInvoicePost,
  proxyConversationMessagePhotoGet,
  proxyConversationPost,
  proxyConversationReadPost,
  proxyConversationsGet,
  proxyConversationsPost,
  proxyNotificationReadPost,
  proxyNotificationsGet,
  proxyNotificationsReadAllPost,
  proxyMePushSubscriptionsDelete,
  proxyMePushSubscriptionsPost,
  proxyMessagesComposeTargetGet,
  proxyMessagesGet,
  proxyMessagesHiddenGet,
  proxyMessagesInvoicePost,
  proxyMessagesPhotoGet,
  proxyMessagesPost,
  proxyMessagesRepliesGet,
  proxyMessagesVideoGet,
  proxyForumMessageGet,
  proxyPublicMessageGet,
  proxyShortLinkGet,
  proxyPublicMessageRepliesGet,
  proxyPushVapidPublicGet,
  proxyViewActivityGet,
  proxyTrustAppointModeratorPost,
  proxyTrustChainGet,
  proxyTrustConfirmModeratorPost,
  proxyTrustProposeModeratorPost,
  proxyTrustRejectModeratorPost,
  proxyTrustProposalsGet,
  proxyTrustVerifyPost,
  proxyFundingAdmitPost,
  proxyFundingApplicationGet,
  proxyFundingApplicationsGet,
  proxyFundingApplyPost,
  proxyFundingRejectPost,
  proxyFundingTrialPost,
  proxyViewAboutPhotoGet,
  proxyViewGet,
} from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

/** Stub fetch and set the upstream api URL. */
function stubApi(): ReturnType<typeof vi.fn> {
  process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('api proxy wrappers', () => {
  it('proxyAuthPasskeyReplaceBeginPost hits POST /auth/passkey/replace/begin', async () => {
    const fetchMock = stubApi();
    await proxyAuthPasskeyReplaceBeginPost(
      new Request('http://localhost/auth/passkey/replace/begin', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/passkey/replace/begin');
  });

  it('proxyAuthPasskeyReplaceFinishPost hits POST /auth/passkey/replace/finish', async () => {
    const fetchMock = stubApi();
    await proxyAuthPasskeyReplaceFinishPost(
      new Request('http://localhost/auth/passkey/replace/finish', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/passkey/replace/finish');
  });

  it('proxyMeWalletBackupSeenPost hits POST /me/wallet-backup-seen', async () => {
    const fetchMock = stubApi();
    await proxyMeWalletBackupSeenPost(
      new Request('http://localhost/me/wallet-backup-seen', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/wallet-backup-seen');
  });

  it('proxyPosGet hits GET /pos', async () => {
    const fetchMock = stubApi();
    await proxyPosGet(new Request('http://localhost/pos/charge'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/pos');
  });

  it('proxyPosPost hits POST /pos', async () => {
    const fetchMock = stubApi();
    await proxyPosPost(
      new Request('http://localhost/pos/charge', { method: 'POST', body: '{"amountSats":21}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/pos');
  });

  it('proxyPosDelete hits DELETE /pos', async () => {
    const fetchMock = stubApi();
    await proxyPosDelete(new Request('http://localhost/pos/charge', { method: 'DELETE' }));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/pos');
  });

  it('proxyMeGet hits /me', async () => {
    const fetchMock = stubApi();
    await proxyMeGet(new Request('http://localhost/me'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me');
  });

  it('proxyMeActivityGet hits /me/activity', async () => {
    const fetchMock = stubApi();
    await proxyMeActivityGet(new Request('http://localhost/me/activity'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/activity');
  });

  it('proxyMeNamePost hits POST /me/name', async () => {
    const fetchMock = stubApi();
    await proxyMeNamePost(new Request('http://localhost/me/name', { method: 'POST', body: '{}' }));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/name');
  });

  it('proxyMeUsernamePost hits POST /me/username', async () => {
    const fetchMock = stubApi();
    await proxyMeUsernamePost(
      new Request('http://localhost/me/username', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/username');
  });

  it('proxyMeLocationPost hits POST /me/location', async () => {
    const fetchMock = stubApi();
    await proxyMeLocationPost(
      new Request('http://localhost/me/location', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/location');
  });

  it('proxyMeAboutPut hits PUT /me/about', async () => {
    const fetchMock = stubApi();
    await proxyMeAboutPut(
      new Request('http://localhost/me/about', { method: 'PUT', body: '{"text":"Hi"}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('PUT');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/about');
  });

  it('proxyMeAboutPhotoGet hits GET /me/about/photo', async () => {
    const fetchMock = stubApi();
    await proxyMeAboutPhotoGet(new Request('http://localhost/me/about/photo'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/about/photo');
  });

  it('proxyMeSetupSkipPost hits POST /me/setup/skip', async () => {
    const fetchMock = stubApi();
    await proxyMeSetupSkipPost(
      new Request('http://localhost/me/setup/skip', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/setup/skip');
  });

  it('proxyMembersGet hits GET /members/:id', async () => {
    const fetchMock = stubApi();
    await proxyMembersGet(new Request('http://localhost/forum/members/acc%201'), 'acc 1');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/members/acc%201');
  });

  it('proxyMembersActivityGet hits GET /members/:id/activity', async () => {
    const fetchMock = stubApi();
    await proxyMembersActivityGet(
      new Request('http://localhost/forum/members/acc%201/activity'),
      'acc 1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/members/acc%201/activity');
  });

  it('proxyMembersPostsGet encodes the id in GET /members/:id/posts', async () => {
    const fetchMock = stubApi();
    await proxyMembersPostsGet(new Request('http://localhost/forum/members/a%2Fb/posts'), 'a/b');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/members/a%2Fb/posts');
  });

  it('proxyMembersRepliesGet encodes the id in GET /members/:id/replies', async () => {
    const fetchMock = stubApi();
    await proxyMembersRepliesGet(
      new Request('http://localhost/forum/members/a%2Fb/replies'),
      'a/b',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/members/a%2Fb/replies');
  });

  it('proxyMeForumLawsDismissedPost hits POST /me/forum-laws-dismissed', async () => {
    const fetchMock = stubApi();
    await proxyMeForumLawsDismissedPost(
      new Request('http://localhost/me/forum-laws-dismissed', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/forum-laws-dismissed');
  });

  it('proxyMeNotificationLevelPost hits POST /me/notification-level', async () => {
    const fetchMock = stubApi();
    await proxyMeNotificationLevelPost(
      new Request('http://localhost/me/notification-level', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/notification-level');
  });

  it('proxyMeLightningAddressPost hits POST /me/lightning-address', async () => {
    const fetchMock = stubApi();
    await proxyMeLightningAddressPost(
      new Request('http://localhost/me/lightning-address', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });

  it('proxyMeLightningAddressDelete hits DELETE /me/lightning-address', async () => {
    const fetchMock = stubApi();
    await proxyMeLightningAddressDelete(
      new Request('http://localhost/me/lightning-address', { method: 'DELETE' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
  });

  it('proxyMeRulesAgreementPost hits POST /me/rules-agreement', async () => {
    const fetchMock = stubApi();
    await proxyMeRulesAgreementPost(
      new Request('http://localhost/me/rules-agreement', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/rules-agreement');
  });

  it('proxyLightningAddressGet hits /lightning-address', async () => {
    const fetchMock = stubApi();
    await proxyLightningAddressGet(
      new Request('http://localhost/lightning-address?address=a@b.com'),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/lightning-address');
  });

  it('proxyGiftsStatsGet hits /gifts/stats', async () => {
    const fetchMock = stubApi();
    await proxyGiftsStatsGet(new Request('http://localhost/gifts/stats'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/gifts/stats');
  });

  it('proxyGiftsStatsGet forwards recipient', async () => {
    const fetchMock = stubApi();
    await proxyGiftsStatsGet(new Request('http://localhost/gifts/stats?recipient=alice'));
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/gifts/stats');
    expect(url.searchParams.get('recipient')).toBe('alice');
  });

  it('proxyGiftsGet hits /gifts and forwards day', async () => {
    const fetchMock = stubApi();
    await proxyGiftsGet(new Request('http://localhost/gifts?day=2026-06-01'));
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/gifts');
    expect(url.searchParams.get('day')).toBe('2026-06-01');
  });

  it('proxyMessagesComposeTargetGet hits /messages/compose-target', async () => {
    const fetchMock = stubApi();
    await proxyMessagesComposeTargetGet(new Request('http://localhost/messages/compose-target'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/compose-target');
  });

  it('proxyMessagesGet hits /messages', async () => {
    const fetchMock = stubApi();
    await proxyMessagesGet(new Request('http://localhost/messages'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages');
  });

  it('proxyMessagesHiddenGet hits /messages/hidden', async () => {
    const fetchMock = stubApi();
    await proxyMessagesHiddenGet(new Request('http://localhost/forum/messages/hidden'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/hidden');
  });

  it('proxyMessagesPost hits POST /messages', async () => {
    const fetchMock = stubApi();
    await proxyMessagesPost(
      new Request('http://localhost/messages', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages');
  });

  it('proxyMessagesRepliesGet hits /messages/:id/replies', async () => {
    const fetchMock = stubApi();
    await proxyMessagesRepliesGet(new Request('http://localhost/forum/messages/m1/replies'), 'm1');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/replies');
  });

  it('proxyForumMessageGet hits /messages/:id with the incoming request', async () => {
    const fetchMock = stubApi();
    await proxyForumMessageGet(
      new Request('http://localhost/forum/messages/m1', {
        headers: { authorization: 'Bearer sess' },
      }),
      'm1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1');
    expect(
      new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get('authorization'),
    ).toBe('Bearer sess');
  });

  it('proxyPublicMessageGet hits /messages/:id', async () => {
    const fetchMock = stubApi();
    await proxyPublicMessageGet(new Request('http://localhost/public-messages/m1'), 'm1');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1');
  });

  it('proxyShortLinkGet hits /links/:code without a bearer', async () => {
    const fetchMock = stubApi();
    await proxyShortLinkGet(new Request('http://localhost/links/d70c4763'), 'd70c4763');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/links/d70c4763');
    await proxyShortLinkGet(new Request('http://localhost/links/a%20b'), 'a b');
    const spaced = fetchMock.mock.calls[1]?.[0] as URL;
    expect(decodeURIComponent(spaced.pathname)).toBe('/links/a b');
    expect(spaced.href.startsWith('https://api.test/links/')).toBe(true);
  });

  it('proxyPublicMessageRepliesGet hits /messages/:id/replies', async () => {
    const fetchMock = stubApi();
    await proxyPublicMessageRepliesGet(
      new Request('http://localhost/public-messages/m1/replies'),
      'm1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/replies');
  });

  it('proxyContactPost hits POST /contact', async () => {
    const fetchMock = stubApi();
    await proxyContactPost(
      new Request('http://localhost/contact/submit', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/contact');
  });

  it('proxyConversationsGet hits /conversations', async () => {
    const fetchMock = stubApi();
    await proxyConversationsGet(new Request('http://localhost/conversations'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/conversations');
  });

  it('proxyConversationsPost hits POST /conversations', async () => {
    const fetchMock = stubApi();
    await proxyConversationsPost(
      new Request('http://localhost/conversations', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/conversations');
  });

  it('proxyConversationGet hits /conversations/:id', async () => {
    const fetchMock = stubApi();
    await proxyConversationGet(new Request('http://localhost/conversations/c1'), 'c1');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/conversations/c1');
  });

  it('proxyConversationPost encodes the id', async () => {
    const fetchMock = stubApi();
    await proxyConversationPost(
      new Request('http://localhost/conversations/a%2Fb', { method: 'POST', body: '{}' }),
      'a/b',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/conversations/a%2Fb');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });

  it('proxyConversationInvoicePost hits /conversations/:id/invoice', async () => {
    const fetchMock = stubApi();
    await proxyConversationInvoicePost(
      new Request('http://localhost/conversations/c1/invoice', { method: 'POST', body: '{}' }),
      'c1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/conversations/c1/invoice');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });

  it('proxyConversationMessagePhotoGet hits /photo', async () => {
    const fetchMock = stubApi();
    await proxyConversationMessagePhotoGet(
      new Request('http://localhost/conversations/c1/messages/m1/photo'),
      'c1',
      'm1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/conversations/c1/messages/m1/photo',
    );
  });

  it('proxyConversationMessagePhotoGet hits an extra still file', async () => {
    const fetchMock = stubApi();
    await proxyConversationMessagePhotoGet(
      new Request('http://localhost/conversations/c1/messages/m1/photo/2.jpg'),
      'c1',
      'm1',
      '2.jpg',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/conversations/c1/messages/m1/photo/2.jpg',
    );
  });

  it('proxyConversationReadPost encodes the id', async () => {
    const fetchMock = stubApi();
    await proxyConversationReadPost(
      new Request('http://localhost/conversations/a%2Fb/read', { method: 'POST' }),
      'a/b',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/conversations/a%2Fb/read');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });

  it('proxyNotificationsGet hits /notifications', async () => {
    const fetchMock = stubApi();
    await proxyNotificationsGet(new Request('http://localhost/forum/notifications'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/notifications');
  });

  it('proxyNotificationsReadAllPost hits POST /notifications/read-all', async () => {
    const fetchMock = stubApi();
    await proxyNotificationsReadAllPost(
      new Request('http://localhost/forum/notifications/read-all', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/notifications/read-all');
  });

  it('proxyNotificationReadPost encodes the id', async () => {
    const fetchMock = stubApi();
    await proxyNotificationReadPost(
      new Request('http://localhost/forum/notifications/a%2Fb/read', { method: 'POST' }),
      'a/b',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/notifications/a%2Fb/read');
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
  });

  it('proxyMessagesPhotoGet hits /messages/:id/photo', async () => {
    const fetchMock = stubApi();
    await proxyMessagesPhotoGet(new Request('http://localhost/messages/m1/photo'), 'm1');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/photo');
  });

  it('proxyMessagesPhotoGet encodes the id', async () => {
    const fetchMock = stubApi();
    await proxyMessagesPhotoGet(new Request('http://localhost/messages/a%2Fb/photo'), 'a/b');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/a%2Fb/photo');
  });

  it('proxyMessagesPhotoGet hits an indexed extra still', async () => {
    const fetchMock = stubApi();
    await proxyMessagesPhotoGet(
      new Request('http://localhost/messages/m1/photo/1.jpg'),
      'm1',
      '1.jpg',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/photo/1.jpg');
  });

  it('proxyMessagesVideoGet hits /messages/m1/video.mp4', async () => {
    const fetchMock = stubApi();
    await proxyMessagesVideoGet(new Request('http://localhost/messages/m1/video.mp4'), 'm1', 'mp4');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/video.mp4');
  });

  it('proxyMessagesVideoGet encodes the id', async () => {
    const fetchMock = stubApi();
    await proxyMessagesVideoGet(
      new Request('http://localhost/messages/a%2Fb/video.mp4'),
      'a/b',
      'mp4',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/a%2Fb/video.mp4');
  });

  it('proxyMessagesVideoGet hits webm and mov pathnames', async () => {
    const fetchMock = stubApi();
    await proxyMessagesVideoGet(
      new Request('http://localhost/messages/m1/video.webm'),
      'm1',
      'webm',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/video.webm');
    await proxyMessagesVideoGet(new Request('http://localhost/messages/m1/video.mov'), 'm1', 'mov');
    expect((fetchMock.mock.calls[1]?.[0] as URL).pathname).toBe('/messages/m1/video.mov');
  });

  it('proxyAuthPasskeyRegisterBeginPost hits /auth/passkey/register/begin', async () => {
    const fetchMock = stubApi();
    await proxyAuthPasskeyRegisterBeginPost(
      new Request('http://localhost/auth/passkey/register/begin', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/passkey/register/begin');
  });

  it('proxyAuthPasskeyRegisterFinishPost hits /auth/passkey/register/finish', async () => {
    const fetchMock = stubApi();
    await proxyAuthPasskeyRegisterFinishPost(
      new Request('http://localhost/auth/passkey/register/finish', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/passkey/register/finish');
  });

  it('proxyAuthPasskeyAuthenticateBeginPost hits /auth/passkey/authenticate/begin', async () => {
    const fetchMock = stubApi();
    await proxyAuthPasskeyAuthenticateBeginPost(
      new Request('http://localhost/auth/passkey/authenticate/begin', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/passkey/authenticate/begin');
  });

  it('proxyAuthPasskeyAuthenticateFinishPost hits /auth/passkey/authenticate/finish', async () => {
    const fetchMock = stubApi();
    await proxyAuthPasskeyAuthenticateFinishPost(
      new Request('http://localhost/auth/passkey/authenticate/finish', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(
      '/auth/passkey/authenticate/finish',
    );
  });

  it('proxyMessagesInvoicePost hits POST /messages/:id/invoice', async () => {
    const fetchMock = stubApi();
    await proxyMessagesInvoicePost(
      new Request('http://localhost/messages/m1/invoice', { method: 'POST', body: '{}' }),
      'm1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/invoice');
  });

  it('proxyViewGet hits /view/:viewKey (encoded)', async () => {
    const fetchMock = stubApi();
    const viewKey = 'a'.repeat(64);
    await proxyViewGet(new Request(`http://localhost/view-key/${viewKey}`), viewKey);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(`/view/${viewKey}`);
  });

  it('proxyViewAboutPhotoGet hits /view/:viewKey/about/photo (encoded)', async () => {
    const fetchMock = stubApi();
    const viewKey = 'a'.repeat(64);
    await proxyViewAboutPhotoGet(
      new Request(`http://localhost/view-key/${viewKey}/about/photo`),
      viewKey,
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(`/view/${viewKey}/about/photo`);
  });

  it('proxyViewAboutPhotoGet encodes the view key', async () => {
    const fetchMock = stubApi();
    await proxyViewAboutPhotoGet(new Request('http://localhost/view-key/a%2Fb/about/photo'), 'a/b');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/view/a%2Fb/about/photo');
  });

  it('proxyViewActivityGet hits /view/:viewKey/activity', async () => {
    const fetchMock = stubApi();
    const viewKey = 'a'.repeat(64);
    await proxyViewActivityGet(
      new Request(`http://localhost/view-key/${viewKey}/activity`),
      viewKey,
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(`/view/${viewKey}/activity`);
  });

  it('proxyPushVapidPublicGet hits /push/vapid-public', async () => {
    const fetchMock = stubApi();
    await proxyPushVapidPublicGet(new Request('http://localhost/push/vapid-public'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/push/vapid-public');
  });

  it('proxyMePushSubscriptionsPost hits POST /me/push-subscriptions', async () => {
    const fetchMock = stubApi();
    await proxyMePushSubscriptionsPost(
      new Request('http://localhost/me/push-subscriptions', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/push-subscriptions');
  });

  it('proxyMePushSubscriptionsDelete hits DELETE /me/push-subscriptions', async () => {
    const fetchMock = stubApi();
    await proxyMePushSubscriptionsDelete(
      new Request('http://localhost/me/push-subscriptions', { method: 'DELETE', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('DELETE');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/push-subscriptions');
  });

  it('proxyTrustChainGet hits /trust-chain', async () => {
    const fetchMock = stubApi();
    await proxyTrustChainGet(new Request('http://localhost/trust-chain'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/trust-chain');
  });

  it('proxyTrustChainGet forwards around', async () => {
    const fetchMock = stubApi();
    await proxyTrustChainGet(new Request('http://localhost/trust/graph?around=acc%2F1'));
    const dest = fetchMock.mock.calls[0]?.[0] as URL;
    expect(dest.pathname).toBe('/trust-chain');
    expect(dest.search).toBe('?around=acc%2F1');
  });

  it('proxyTrustProposalsGet hits GET /trust/proposals', async () => {
    const fetchMock = stubApi();
    await proxyTrustProposalsGet(new Request('http://localhost/trust/proposals'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/trust/proposals');
  });

  it('proxyTrustVerifyPost hits POST /trust/verify', async () => {
    const fetchMock = stubApi();
    await proxyTrustVerifyPost(
      new Request('http://localhost/trust/verify', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/trust/verify');
  });

  it('proxyTrustProposeModeratorPost hits POST /trust/propose-moderator', async () => {
    const fetchMock = stubApi();
    await proxyTrustProposeModeratorPost(
      new Request('http://localhost/trust/propose-moderator', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/trust/propose-moderator');
  });

  it('proxyTrustConfirmModeratorPost hits POST /trust/confirm-moderator', async () => {
    const fetchMock = stubApi();
    await proxyTrustConfirmModeratorPost(
      new Request('http://localhost/trust/confirm-moderator', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/trust/confirm-moderator');
  });

  it('proxyTrustRejectModeratorPost hits POST /trust/reject-moderator', async () => {
    const fetchMock = stubApi();
    await proxyTrustRejectModeratorPost(
      new Request('http://localhost/trust/reject-moderator', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/trust/reject-moderator');
  });

  it('proxyTrustAppointModeratorPost hits POST /trust/appoint-moderator', async () => {
    const fetchMock = stubApi();
    await proxyTrustAppointModeratorPost(
      new Request('http://localhost/trust/appoint-moderator', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/trust/appoint-moderator');
  });

  it('proxyFundingApplyPost hits POST /funding/apply', async () => {
    const fetchMock = stubApi();
    await proxyFundingApplyPost(
      new Request('http://localhost/funding/apply', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/apply');
  });

  it('proxyFundingApplicationsGet hits GET /funding/applications', async () => {
    const fetchMock = stubApi();
    await proxyFundingApplicationsGet(new Request('http://localhost/funding/applications'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/applications');
  });

  it('proxyFundingApplicationGet hits GET /funding/applications/:accountId', async () => {
    const fetchMock = stubApi();
    await proxyFundingApplicationGet(
      new Request('http://localhost/funding/applications/acc%2F1'),
      'acc/1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/applications/acc%2F1');
  });

  it('proxyFundingTrialPost hits POST /funding/trial', async () => {
    const fetchMock = stubApi();
    await proxyFundingTrialPost(
      new Request('http://localhost/funding/trial', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/trial');
  });

  it('proxyFundingAdmitPost hits POST /funding/admit', async () => {
    const fetchMock = stubApi();
    await proxyFundingAdmitPost(
      new Request('http://localhost/funding/admit', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/admit');
  });

  it('proxyFundingRejectPost hits POST /funding/reject', async () => {
    const fetchMock = stubApi();
    await proxyFundingRejectPost(
      new Request('http://localhost/funding/reject', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/reject');
  });
});
