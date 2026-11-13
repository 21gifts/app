// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/wallets/usage/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /wallets/usage', () => {
  it('is the wallet usage proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ releasedAt: '2026-11-09T11:17:00.000Z' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(new Request('http://localhost/wallets/usage'));
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/wallets/usage');
  });
});
