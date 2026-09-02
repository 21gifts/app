// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/me/setup/skip/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/me/setup/skip', () => {
  it('exports a POST proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (
        await POST(
          new Request('http://localhost/me/setup/skip', {
            method: 'POST',
            body: JSON.stringify({ step: 'name' }),
          }),
        )
      ).status,
    ).toBe(200);
  });
});
