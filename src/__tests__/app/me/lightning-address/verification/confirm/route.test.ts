// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/me/lightning-address/verification/confirm/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /me/lightning-address/verification/confirm', () => {
  it('is the verification confirm proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (
        await POST(
          new Request('http://localhost/me/lightning-address/verification/confirm', {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(200);
  });
});
