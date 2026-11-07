// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/me/held-shares/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /me/held-shares', () => {
  it('forwards Bearer auth to the api path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const upstreamBody = JSON.stringify({
      boxes: [{ id: 'a'.repeat(32), ciphertext: 'AQID', updatedAt: '2026-10-30T12:00:00.000Z' }],
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(upstreamBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(
      new Request('http://localhost/me/held-shares', {
        headers: { authorization: 'Bearer token' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(upstreamBody);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.test/me/held-shares');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
  });
});
