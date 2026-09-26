// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/funding/payout-days/route';
import { proxyFundingPayoutDaysGet } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /funding/payout-days', () => {
  it('re-exports proxyFundingPayoutDaysGet', async () => {
    expect(GET).toBe(proxyFundingPayoutDaysGet);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect((await GET(new Request('http://localhost/funding/payout-days'))).status).toBe(200);
  });
});
