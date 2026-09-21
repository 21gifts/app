// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/funding/reject/route';
import { proxyFundingRejectPost } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /funding/reject', () => {
  it('re-exports proxyFundingRejectPost', async () => {
    expect(POST).toBe(proxyFundingRejectPost);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (await POST(new Request('http://localhost/funding/reject', { method: 'POST', body: '{}' })))
        .status,
    ).toBe(200);
  });
});
