// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/me/wallet/hearts/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /me/wallet/hearts', () => {
  it('exports the proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      new Request('http://localhost/me/wallet/hearts', { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/me/wallet/hearts');
  });
});
