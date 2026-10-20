// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/pictures/[accountId]/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/pictures/[accountId]', () => {
  it('proxies GET to the public picture files', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(new Request('http://localhost/pictures/acc_1'), {
      params: Promise.resolve({ accountId: 'acc_1' }),
    });
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/pictures/acc_1.jpg');
  });
});
