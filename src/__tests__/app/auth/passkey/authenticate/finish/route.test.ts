// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/auth/passkey/authenticate/finish/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /auth/passkey/authenticate/finish', () => {
  it('exports the proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (
        await POST(
          new Request('http://localhost/auth/passkey/authenticate/finish', {
            method: 'POST',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(200);
  });
});
