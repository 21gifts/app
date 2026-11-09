// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/me/previous-wallets/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /me/previous-wallets', () => {
  it('forwards Bearer auth to the api path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"wallets":[]}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(
      new Request('http://localhost/me/previous-wallets', {
        headers: { authorization: 'Bearer token' },
      }),
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/me/previous-wallets');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
  });
});
