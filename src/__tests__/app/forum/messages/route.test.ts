// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/forum/messages/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/forum/messages', () => {
  it('exports a GET proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect((await GET(new Request('http://localhost/forum/messages'))).status).toBe(200);
  });

  it('exports a POST proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (
        await POST(
          new Request('http://localhost/forum/messages', { method: 'POST', body: '{}' }),
        )
      ).status,
    ).toBe(200);
  });
});
