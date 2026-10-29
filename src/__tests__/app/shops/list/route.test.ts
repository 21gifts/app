// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/shops/list/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /shops/list', () => {
  it('proxies to pathname /shops and keeps the query', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(new Request('http://localhost/shops/list?limit=20&cursor=abc'));
    expect(response.status).toBe(200);
    const target = fetchMock.mock.calls[0]?.[0] as URL;
    expect(target.pathname).toBe('/shops');
    expect(target.search).toBe('?limit=20&cursor=abc');
  });
});
