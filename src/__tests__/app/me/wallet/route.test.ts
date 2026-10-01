// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/me/wallet/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('PUT /me/wallet', () => {
  it('exports the proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await PUT(
      new Request('http://localhost/me/wallet', { method: 'PUT', body: '{}' }),
    );
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/wallet');
  });
});
