// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/view-key/[viewKey]/shops/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /view-key/[viewKey]/shops', () => {
  it('proxies the public shops list', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const viewKey = 'a'.repeat(64);
    expect(
      (
        await GET(new Request(`http://localhost/view-key/${viewKey}/shops`), {
          params: Promise.resolve({ viewKey }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(`/view/${viewKey}/shops`);
  });
});
