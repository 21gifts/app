// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/view-key/[viewKey]/activity/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /view-key/[viewKey]/activity', () => {
  it('is the view-activity proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const viewKey = 'a'.repeat(64);
    expect(
      (
        await GET(new Request(`http://localhost/view-key/${viewKey}/activity`), {
          params: Promise.resolve({ viewKey }),
        })
      ).status,
    ).toBe(200);
  });
});
