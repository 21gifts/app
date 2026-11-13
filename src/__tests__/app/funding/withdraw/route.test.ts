// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/funding/withdraw/route';
import { proxyFundingWithdrawPost } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /funding/withdraw', () => {
  it('re-exports proxyFundingWithdrawPost', async () => {
    expect(POST).toBe(proxyFundingWithdrawPost);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (await POST(new Request('http://localhost/funding/withdraw', { method: 'POST' }))).status,
    ).toBe(200);
  });
});
