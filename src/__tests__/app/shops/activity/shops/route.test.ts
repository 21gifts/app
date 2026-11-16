// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/shops/activity/shops/route';
import { proxyShopActivityShopsGet } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /shops/activity/shops', () => {
  it('re-exports proxyShopActivityShopsGet', async () => {
    expect(GET).toBe(proxyShopActivityShopsGet);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await GET(new Request('http://localhost/shops/activity/shops'))).status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/shops/activity/shops');
  });
});
