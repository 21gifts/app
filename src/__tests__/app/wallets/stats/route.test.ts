// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/wallets/stats/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /wallets/stats', () => {
  it('is the wallet stats proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          walletCount: 0,
          fundedWalletCount: 0,
          totalSats: 0,
          totalBtc: '0.00000000',
          asOf: null,
          balanceOverTime: [],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(new Request('http://localhost/wallets/stats'));
    expect(response.status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/wallets/stats');
  });
});
