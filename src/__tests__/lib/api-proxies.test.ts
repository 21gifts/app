// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  proxyAuthLnurlCallbackGet,
  proxyAuthLnurlGet,
  proxyAuthSessionGet,
  proxyLightningAddressGet,
  proxyGiftsStatsGet,
  proxyMeGet,
  proxyMeLightningAddressDelete,
  proxyMeLightningAddressPost,
  proxyMeNamePost,
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
  it('proxyAuthLnurlGet hits /auth/lnurl', async () => {
    const fetchMock = stubApi();
    const res = await proxyAuthLnurlGet(new Request('http://localhost/auth/lnurl'));
    expect(res.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/lnurl');
  });

  it('proxyAuthLnurlCallbackGet hits /auth/lnurl/callback', async () => {
    const fetchMock = stubApi();
    await proxyAuthLnurlCallbackGet(new Request('http://localhost/auth/lnurl/callback?k1=aa'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/lnurl/callback');
  });

  it('proxyAuthSessionGet hits /auth/session', async () => {
    const fetchMock = stubApi();
    await proxyAuthSessionGet(new Request('http://localhost/auth/session'));
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/auth/session');
  });

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
});
