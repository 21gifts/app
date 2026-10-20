// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/lnurlp/[username]/invoice/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /lnurlp/ada/invoice', () => {
  it('forwards to the api path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(
      new Request('http://localhost/lnurlp/ada/invoice', { method: 'GET' }),
      {
        params: Promise.resolve({ username: 'ada' }),
      },
    );
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/lnurlp/ada/invoice');
  });
});
