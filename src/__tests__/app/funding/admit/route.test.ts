// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/funding/admit/route';
import { proxyFundingAdmitPost } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /funding/admit', () => {
  it('re-exports proxyFundingAdmitPost', async () => {
    expect(POST).toBe(proxyFundingAdmitPost);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (await POST(new Request('http://localhost/funding/admit', { method: 'POST', body: '{}' })))
        .status,
    ).toBe(200);
  });
});
