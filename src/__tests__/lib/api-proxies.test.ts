// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  proxyDiagnosticsPost,
  proxyAuthPasskeyAuthenticateBeginPost,
  proxyAuthPasskeyAuthenticateFinishPost,
  proxyAuthPasskeyRegisterBeginPost,
  proxyAuthPasskeyRegisterFinishPost,
  proxyAuthPasskeyReplaceBeginPost,
  proxyAuthPasskeyReplaceFinishPost,
  proxyAuthPasskeySeedBeginPost,
  proxyAuthPasskeySeedFinishPost,
  proxyMeWalletBackupSeenPost,
  proxyMeWalletReportPost,
  proxyMeEventsPost,
  proxyMeWalletPut,
  proxyLnurlpayRegisterPost,
  proxyLnurlpayRecoverPost,
  proxyLnurlpayMetadataGet,
  proxyLnurlpInvoiceGet,
  proxyVerifyGet,
  proxyMePasskeyRenewAckPost,
  proxyMePasskeyRenewReportPost,
  proxyGiftsGet,
  proxyGiftsStatsGet,
  proxyFxSpotGet,
  proxyMeActivityGet,
  proxyMeLoansGet,
  proxyMeGet,
  proxyPosDelete,
  proxyPosGet,
  proxyPosPost,
  proxyMeForumLawsDismissedPost,
  proxyMeAmountUnitPost,
  proxyMeFiatPost,
  proxyMeLocalePost,
  proxyMeNotificationLevelPost,
  proxyMeHeartNotificationsPost,
  proxyMeLocationPost,
  proxyMeAboutPhotoGet,
  proxyProfilePhotoGet,
  proxyProfilePhotoPut,
  proxyWideBannerGet,
  proxyWideBannerPut,
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
  proxyLnurlInvoicePost,
  proxyLnurlPayRequestPost,
  proxyConversationGet,
  proxyConversationInvoicePost,
  proxyConversationMessagePhotoGet,
  proxyConversationPost,
  proxyConversationReadPost,
  proxyConversationsGet,
  proxyConversationsPost,
  proxyNotificationReadPost,
  proxyNotificationsGet,
  proxyForumMentionsGet,
  proxyNotificationsReadAllPost,
  proxyNotificationsReadByMessagePost,
  proxyNotificationsReadVisiblePost,
  proxyMePushSubscriptionsDelete,
  proxyMePushSubscriptionsPost,
  proxyMessagesComposeTargetGet,
  proxyMessagesGet,
  proxyMessagesHiddenGet,
  proxyMessagesPlacesGet,
  proxyMessagesInvoicePost,
  proxyMessagesRepaymentDuePost,
  proxyMessagesPhotoGet,
  proxyMessagesPost,
  proxyMessagesRepliesGet,
  proxyMessagesVideoGet,
  proxyForumMessageGet,
  proxyPublicMessageGet,
  proxyExternalAuthorProfileGet,
  proxyExternalAuthorPostsGet,
  proxyExternalAuthorRepliesGet,
  proxyShortLinkGet,
  proxyPublicMessageRepliesGet,
  proxyPushVapidPublicGet,
  proxyTranslateAvailableGet,
  proxyTranslateConversationMessagePost,
  proxyTranslateNotePost,
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
  proxyFundingPayoutDaysGet,
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

  it('proxyAuthPasskeySeedBeginPost hits POST /auth/passkey/seed/begin', async () => {
    const fetchMock = stubApi();
    await proxyAuthPasskeySeedBeginPost(
      new Request('http://localhost/auth/passkey/seed/begin', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/passkey/seed/begin');
  });

  it('proxyAuthPasskeySeedFinishPost hits POST /auth/passkey/seed/finish', async () => {
    const fetchMock = stubApi();
    await proxyAuthPasskeySeedFinishPost(
      new Request('http://localhost/auth/passkey/seed/finish', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/passkey/seed/finish');
  });

  it('proxyMeWalletBackupSeenPost hits POST /me/wallet-backup-seen', async () => {
    const fetchMock = stubApi();
    await proxyMeWalletBackupSeenPost(
      new Request('http://localhost/me/wallet-backup-seen', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/wallet-backup-seen');
  });

  it('proxyMeWalletReportPost hits POST /me/wallet/report with the body', async () => {
    const fetchMock = stubApi();
    const body = JSON.stringify({ balanceSats: 1, syncedAt: 'now', payments: [] });
    await proxyMeWalletReportPost(
      new Request('http://localhost/me/wallet/report', {
        method: 'POST',
        headers: { authorization: 'Bearer sess', 'content-type': 'application/json' },
        body,
      }),
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/me/wallet/report');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(body);
    expect((init.headers as Headers).get('authorization')).toBe('Bearer sess');
  });

  it('proxyMeEventsPost hits POST /me/events with the body', async () => {
    const fetchMock = stubApi();
    const body = JSON.stringify({ events: [] });
    await proxyMeEventsPost(
      new Request('http://localhost/me/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      }),
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/me/events');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(body);
  });

  it('proxyMeWalletPut hits PUT /me/wallet with the body', async () => {
    const fetchMock = stubApi();
    await proxyMeWalletPut(
      new Request('http://localhost/me/wallet', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: '{"sparkPubkey":"02ab"}',
      }),
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/me/wallet');
    expect(init.method).toBe('PUT');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"sparkPubkey":"02ab"}');
  });

  it('proxyLnurlpayRegisterPost hits POST /lnurlpay/:pubkey', async () => {
    const fetchMock = stubApi();
    await proxyLnurlpayRegisterPost(
      new Request('http://localhost/lnurlpay/02ab', { method: 'POST', body: '{}' }),
      '02ab',
    );
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/lnurlpay/02ab');
    expect(init.method).toBe('POST');
  });

  it('proxyLnurlpayRecoverPost hits POST /lnurlpay/:pubkey/recover', async () => {
    const fetchMock = stubApi();
    await proxyLnurlpayRecoverPost(
      new Request('http://localhost/lnurlpay/02ab/recover', { method: 'POST', body: '{}' }),
      '02ab',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/lnurlpay/02ab/recover');
  });

  it('proxyLnurlpayMetadataGet hits GET /lnurlpay/:pubkey/metadata with the query', async () => {
    const fetchMock = stubApi();
    await proxyLnurlpayMetadataGet(
      new Request('http://localhost/lnurlpay/02ab/metadata?offset=0&limit=5'),
      '02ab',
    );
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/lnurlpay/02ab/metadata');
    expect(url.search).toBe('?offset=0&limit=5');
  });

  it('encodes path segments', async () => {
    const fetchMock = stubApi();
    await proxyLnurlpayRegisterPost(
      new Request('http://localhost/lnurlpay/x', { method: 'POST', body: '{}' }),
      'a/b',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/lnurlpay/a%2Fb');
  });

  it('proxyLnurlpInvoiceGet hits GET /lnurlp/:username/invoice and allows any origin', async () => {
    const fetchMock = stubApi();
    fetchMock.mockResolvedValueOnce(
      new Response('{"pr":"x"}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const res = await proxyLnurlpInvoiceGet(
      new Request('http://localhost/lnurlp/ada/invoice?amount=1000'),
      'ada',
    );
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/lnurlp/ada/invoice');
    expect(url.search).toBe('?amount=1000');
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ pr: 'x' });
  });

  it('proxyVerifyGet hits GET /verify/:paymentHash and allows any origin', async () => {
    const fetchMock = stubApi();
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 404 }));
    const res = await proxyVerifyGet(new Request('http://localhost/verify/abc'), 'abc');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/verify/abc');
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('proxyMePasskeyRenewReportPost hits POST /me/passkey-renew/report', async () => {
    const fetchMock = stubApi();
    await proxyMePasskeyRenewReportPost(
      new Request('http://localhost/me/passkey-renew/report', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/passkey-renew/report');
  });

  it('proxyMePasskeyRenewAckPost hits POST /me/passkey-renew/ack', async () => {
    const fetchMock = stubApi();
    await proxyMePasskeyRenewAckPost(
      new Request('http://localhost/me/passkey-renew/ack', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/passkey-renew/ack');
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

  it('proxyMeLoansGet hits /me/loans', async () => {
    const fetchMock = stubApi();
    await proxyMeLoansGet(new Request('http://localhost/me/loans'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/loans');
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

  it('proxyProfilePhotoGet and proxyProfilePhotoPut hit /pictures/me', async () => {
    const fetchMock = stubApi();
    await proxyProfilePhotoGet(new Request('http://localhost/pictures/me'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/pictures/me');
    await proxyProfilePhotoPut(
      new Request('http://localhost/pictures/me', { method: 'PUT', body: '{"photo":null}' }),
    );
    expect((fetchMock.mock.calls[1]?.[0] as URL).pathname).toBe('/pictures/me');
  });

  it('proxyWideBannerGet and proxyWideBannerPut hit /banners/me', async () => {
    const fetchMock = stubApi();
    await proxyWideBannerGet(new Request('http://localhost/banners/me'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/banners/me');
    await proxyWideBannerPut(
      new Request('http://localhost/banners/me', { method: 'PUT', body: '{"photo":null}' }),
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('PUT');
    expect((fetchMock.mock.calls[1]?.[0] as URL).pathname).toBe('/banners/me');
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

  it('proxyMeHeartNotificationsPost hits POST /me/heart-notifications', async () => {
    const fetchMock = stubApi();
    await proxyMeHeartNotificationsPost(
      new Request('http://localhost/me/heart-notifications', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/heart-notifications');
  });

  it('proxyMeAmountUnitPost hits POST /me/amount-unit', async () => {
    const fetchMock = stubApi();
    await proxyMeAmountUnitPost(new Request('http://localhost/me/amount-unit', { method: 'POST' }));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/amount-unit');
  });

  it('proxyMeLocalePost hits POST /me/locale', async () => {
    const fetchMock = stubApi();
    await proxyMeLocalePost(new Request('http://localhost/me/locale', { method: 'POST' }));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/locale');
  });

  it('proxyMeFiatPost hits POST /me/fiat', async () => {
    const fetchMock = stubApi();
    await proxyMeFiatPost(new Request('http://localhost/me/fiat', { method: 'POST' }));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/fiat');
  });

  it('proxyMeRulesAgreementPost hits POST /me/rules-agreement', async () => {
    const fetchMock = stubApi();
    await proxyMeRulesAgreementPost(
      new Request('http://localhost/me/rules-agreement', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/rules-agreement');
  });

  it('proxyFxSpotGet hits /fx/spot', async () => {
    const fetchMock = stubApi();
    await proxyFxSpotGet(new Request('http://localhost/fx/spot'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/fx/spot');
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

  it('proxyMessagesPlacesGet hits /messages/places', async () => {
    const fetchMock = stubApi();
    await proxyMessagesPlacesGet(new Request('http://localhost/forum/messages/places'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/places');
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

  it('proxyExternalAuthorProfileGet hits /messages/:id/external-profile', async () => {
    const fetchMock = stubApi();
    await proxyExternalAuthorProfileGet(
      new Request('http://localhost/public-messages/m1/external-profile'),
      'm1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/external-profile');
  });

  it('proxyExternalAuthorPostsGet hits /messages/:id/external-posts', async () => {
    const fetchMock = stubApi();
    await proxyExternalAuthorPostsGet(
      new Request('http://localhost/public-messages/m1/external-posts'),
      'm1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/external-posts');
  });

  it('proxyExternalAuthorRepliesGet hits /messages/:id/external-replies', async () => {
    const fetchMock = stubApi();
    await proxyExternalAuthorRepliesGet(
      new Request('http://localhost/public-messages/m1/external-replies'),
      'm1',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/external-replies');
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

  it('proxyLnurlPayRequestPost hits POST /lnurl/pay-request', async () => {
    const fetchMock = stubApi();
    await proxyLnurlPayRequestPost(
      new Request('http://localhost/lnurl/pay-request', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/lnurl/pay-request');
  });

  it('proxyLnurlInvoicePost hits POST /lnurl/invoice', async () => {
    const fetchMock = stubApi();
    await proxyLnurlInvoicePost(
      new Request('http://localhost/lnurl/invoice', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/lnurl/invoice');
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

  it('proxyForumMentionsGet forwards the query to /mentions', async () => {
    const fetchMock = stubApi();
    await proxyForumMentionsGet(new Request('http://localhost/forum/mentions?q=as'));
    const target = fetchMock.mock.calls[0]?.[0] as URL;
    expect(target.pathname).toBe('/mentions');
    expect(target.search).toBe('?q=as');
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

  it('proxyNotificationsReadByMessagePost hits POST /notifications/read-by-message', async () => {
    const fetchMock = stubApi();
    await proxyNotificationsReadByMessagePost(
      new Request('http://localhost/forum/notifications/read-by-message', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/notifications/read-by-message');
  });

  it('proxyNotificationsReadVisiblePost hits POST /notifications/read-visible', async () => {
    const fetchMock = stubApi();
    await proxyNotificationsReadVisiblePost(
      new Request('http://localhost/forum/notifications/read-visible', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/notifications/read-visible');
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

  it('proxyDiagnosticsPost hits /diagnostics', async () => {
    const fetchMock = stubApi();
    await proxyDiagnosticsPost(
      new Request('http://localhost/diagnostics', {
        method: 'POST',
        body: '{"event":"client.unhandled"}',
      }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/diagnostics');
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

  it('proxyMessagesRepaymentDuePost hits POST /messages/:id/repayment/due', async () => {
    const fetchMock = stubApi();
    await proxyMessagesRepaymentDuePost(
      new Request('http://localhost/messages/m1/repayment/due', { method: 'POST' }),
      'a/b',
    );
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/a%2Fb/repayment/due');
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

  it('proxyFundingPayoutDaysGet hits GET /funding/payout-days', async () => {
    const fetchMock = stubApi();
    await proxyFundingPayoutDaysGet(new Request('http://localhost/funding/payout-days'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/payout-days');
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

  it('proxyTranslateAvailableGet hits GET /translate', async () => {
    const fetchMock = stubApi();
    await proxyTranslateAvailableGet(new Request('http://localhost/translate'));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/translate');
  });

  it('proxyTranslateNotePost returns 400 on invalid JSON', async () => {
    const fetchMock = stubApi();
    const response = await proxyTranslateNotePost(
      new Request('http://localhost/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid body' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    null,
    21,
    [],
    { target: 'en' },
    { messageId: 1, target: 'en' },
    { messageId: 'm1' },
    { messageId: 'm1', target: 1 },
  ])(
    'proxyTranslateNotePost returns 400 when messageId or target is missing in %j',
    async (body) => {
      const fetchMock = stubApi();
      const response = await proxyTranslateNotePost(
        new Request('http://localhost/translate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }),
      );
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'Invalid body' });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('proxyTranslateNotePost forwards { target } to /messages/:id/translate', async () => {
    const fetchMock = stubApi();
    const incomingBody = JSON.stringify({ messageId: 'm1', target: 'en' });
    await proxyTranslateNotePost(
      new Request('http://localhost/translate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': String(incomingBody.length),
        },
        body: incomingBody,
      }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/translate');
    expect(init.method).toBe('POST');
    const outgoing = JSON.parse(new TextDecoder().decode(init.body as ArrayBuffer)) as unknown;
    expect(outgoing).toEqual({ target: 'en' });
    expect(outgoing).not.toEqual({ messageId: 'm1', target: 'en' });
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('content-length')).not.toBe(String(incomingBody.length));
  });

  it('proxyTranslateNotePost forwards Authorization and drops a stale content-length', async () => {
    const fetchMock = stubApi();
    await proxyTranslateNotePost(
      new Request('http://localhost/translate', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '9999',
          authorization: 'Bearer tok',
        },
        body: JSON.stringify({ messageId: 'm1', target: 'en' }),
      }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/translate');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('content-length')).not.toBe('9999');
    const outgoing = JSON.parse(new TextDecoder().decode(init.body as ArrayBuffer)) as unknown;
    expect(outgoing).toEqual({ target: 'en' });
    if (headers.get('content-length') !== null) {
      expect(headers.get('content-length')).toBe(String(JSON.stringify({ target: 'en' }).length));
    }
  });

  it('proxyTranslateConversationMessagePost returns 400 on invalid JSON', async () => {
    const fetchMock = stubApi();
    const response = await proxyTranslateConversationMessagePost(
      new Request('http://localhost/conversations/c1/messages/m1/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not-json',
      }),
      'c1',
      'm1',
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid body' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxyTranslateConversationMessagePost returns 400 when target is missing', async () => {
    const fetchMock = stubApi();
    const response = await proxyTranslateConversationMessagePost(
      new Request('http://localhost/conversations/c1/messages/m1/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: 1 }),
      }),
      'c1',
      'm1',
    );
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('proxyTranslateConversationMessagePost forwards target and Authorization', async () => {
    const fetchMock = stubApi();
    await proxyTranslateConversationMessagePost(
      new Request('http://localhost/conversations/c1/messages/m1/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer tok' },
        body: JSON.stringify({ target: 'de' }),
      }),
      'c 1',
      'm/1',
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const called = fetchMock.mock.calls[0]?.[0] as URL;
    expect(called.pathname).toBe('/conversations/c%201/messages/m%2F1/translate');
    expect(JSON.parse(new TextDecoder().decode(init.body as ArrayBuffer))).toEqual({
      target: 'de',
    });
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer tok');
  });
});
