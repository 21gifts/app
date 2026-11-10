// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/fond/payouts/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /fond/payouts', () => {
  it('forwards Bearer auth to the api path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const upstreamBody = JSON.stringify({
      payouts: [{ id: 'row-1', kind: 'daily', status: 'owed', utcDay: '2026-11-10' }],
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(upstreamBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(
      new Request('http://localhost/fond/payouts', {
        headers: { authorization: 'Bearer token' },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(upstreamBody);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.test/fond/payouts');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
  });
});
