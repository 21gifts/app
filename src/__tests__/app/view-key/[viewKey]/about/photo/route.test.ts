// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/view-key/[viewKey]/about/photo/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /view-key/[viewKey]/about/photo', () => {
  it('exports a GET proxy that forwards the view key', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const viewKey = 'a'.repeat(64);
    expect(
      (
        await GET(new Request(`http://localhost/view-key/${viewKey}/about/photo`), {
          params: Promise.resolve({ viewKey }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe(`/view/${viewKey}/about/photo`);
  });

  it('encodes the view key in the upstream path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await GET(new Request('http://localhost/view-key/a%2Fb/about/photo'), {
      params: Promise.resolve({ viewKey: 'a/b' }),
    });
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/view/a%2Fb/about/photo');
  });
});
