// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from '@/app/banners/me/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/banners/me', () => {
  it('proxies GET and PUT', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await GET(new Request('http://localhost/banners/me'))).status).toBe(204);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/banners/me');
    expect(
      (
        await PUT(
          new Request('http://localhost/banners/me', { method: 'PUT', body: '{"photo":null}' }),
        )
      ).status,
    ).toBe(204);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('PUT');
  });
});
