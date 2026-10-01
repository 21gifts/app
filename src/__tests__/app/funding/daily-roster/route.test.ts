// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/funding/daily-roster/route';
import { proxyFundingDailyRosterGet } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /funding/daily-roster', () => {
  it('re-exports proxyFundingDailyRosterGet', async () => {
    expect(GET).toBe(proxyFundingDailyRosterGet);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(
          new Request('http://localhost/funding/daily-roster', { method: 'GET', body: null }),
        )
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/daily-roster');
  });
});
