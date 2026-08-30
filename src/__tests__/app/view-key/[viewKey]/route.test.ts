// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/view-key/[viewKey]/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /view-key/[viewKey]', () => {
  it('is the view-profile proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const viewKey = 'a'.repeat(64);
    expect(
      (
        await GET(new Request(`http://localhost/view-key/${viewKey}`), {
          params: Promise.resolve({ viewKey }),
        })
      ).status,
    ).toBe(200);
  });
});
