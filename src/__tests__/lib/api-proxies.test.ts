// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  proxyAuthPasskeyAuthenticateBeginPost,
  proxyAuthPasskeyAuthenticateFinishPost,
  proxyAuthPasskeyRegisterBeginPost,
  proxyAuthPasskeyRegisterFinishPost,
  proxyLightningAddressGet,
  proxyGiftsGet,
  proxyGiftsStatsGet,
  proxyMeGet,
  proxyMeForumLawsDismissedPost,
  proxyMeLightningAddressDelete,
  proxyMeLightningAddressPost,
  proxyMeNamePost,
  proxyMeRulesAgreementPost,
  proxyContactPost,
  proxyMessagesGet,
  proxyMessagesInvoicePost,
  proxyMessagesPhotoGet,
  proxyMessagesPost,
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
  it('proxyMeGet hits /me', async () => {
    const fetchMock = stubApi();
    await proxyMeGet(new Request('http://localhost/me'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me');
  });

  it('proxyMeNamePost hits POST /me/name', async () => {
    const fetchMock = stubApi();
    await proxyMeNamePost(new Request('http://localhost/me/name', { method: 'POST', body: '{}' }));
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/name');
  });

  it('proxyMeForumLawsDismissedPost hits POST /me/forum-laws-dismissed', async () => {
    const fetchMock = stubApi();
    await proxyMeForumLawsDismissedPost(
      new Request('http://localhost/me/forum-laws-dismissed', { method: 'POST' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/forum-laws-dismissed');
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

  it('proxyMessagesGet hits /messages', async () => {
    const fetchMock = stubApi();
    await proxyMessagesGet(new Request('http://localhost/messages'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages');
  });

  it('proxyMessagesPost hits POST /messages', async () => {
    const fetchMock = stubApi();
    await proxyMessagesPost(
      new Request('http://localhost/messages', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages');
  });

  it('proxyContactPost hits POST /contact', async () => {
    const fetchMock = stubApi();
    await proxyContactPost(
      new Request('http://localhost/contact/submit', { method: 'POST', body: '{}' }),
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/contact');
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
});
