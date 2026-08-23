// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/auth/passkey/register/finish/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /auth/passkey/register/finish', () => {
  it('exports the proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (
        await POST(
          new Request('http://localhost/auth/passkey/register/finish', {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(200);
  });
});
