// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/trust/proposals/route';
import { proxyTrustProposalsGet } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /trust/proposals', () => {
  it('re-exports proxyTrustProposalsGet', async () => {
    expect(GET).toBe(proxyTrustProposalsGet);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect((await GET(new Request('http://localhost/trust/proposals'))).status).toBe(200);
  });
});
