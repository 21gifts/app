// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/funding/apply/route';
import { proxyFundingApplyPost } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /funding/apply', () => {
  it('re-exports proxyFundingApplyPost', async () => {
    expect(POST).toBe(proxyFundingApplyPost);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (await POST(new Request('http://localhost/funding/apply', { method: 'POST', body: '{}' })))
        .status,
    ).toBe(200);
  });
});
