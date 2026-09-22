// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/messages/stats/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /messages/stats', () => {
  it('is the post stats proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"postCount":0,"postsOverTime":[]}', { status: 200 })),
    );
    const response = await GET(new Request('http://localhost/messages/stats'));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ postCount: 0, postsOverTime: [] });
  });
});
