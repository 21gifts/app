// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/me/about/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/me/about', () => {
  it('exports a PUT proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (
        await PUT(
          new Request('http://localhost/me/about', {
            method: 'PUT',
            body: JSON.stringify({ text: 'Hello' }),
          }),
        )
      ).status,
    ).toBe(200);
  });
});
