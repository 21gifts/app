// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/loans/open/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('open loans proxy', () => {
  it('forwards GET /loans/open to the api', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await GET(new Request('http://localhost/loans/open'))).status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/loans/open');
  });
});
