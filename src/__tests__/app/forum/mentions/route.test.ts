// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/forum/mentions/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/forum/mentions', () => {
  it('exports a GET proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await GET(new Request('http://localhost/forum/mentions?q=as'))).status).toBe(200);
    const target = fetchMock.mock.calls[0]?.[0] as URL;
    expect(target.pathname).toBe('/mentions');
    expect(target.search).toBe('?q=as');
  });
});
