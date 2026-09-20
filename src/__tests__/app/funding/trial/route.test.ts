// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/funding/trial/route';
import { proxyFundingTrialPost } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /funding/trial', () => {
  it('re-exports proxyFundingTrialPost', async () => {
    expect(POST).toBe(proxyFundingTrialPost);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (await POST(new Request('http://localhost/funding/trial', { method: 'POST', body: '{}' })))
        .status,
    ).toBe(200);
  });
});
