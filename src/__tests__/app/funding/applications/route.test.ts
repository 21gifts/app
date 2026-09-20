// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/funding/applications/route';
import { proxyFundingApplicationsGet } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /funding/applications', () => {
  it('re-exports proxyFundingApplicationsGet', async () => {
    expect(GET).toBe(proxyFundingApplicationsGet);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect((await GET(new Request('http://localhost/funding/applications'))).status).toBe(200);
  });
});
