// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/messages/[id]/repayment/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/messages/[id]/repayment', () => {
  it('exports GET and POST proxies', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const got = await GET(new Request('http://localhost/messages/m1/repayment'), {
      params: Promise.resolve({ id: 'm1' }),
    });
    expect(got.status).toBe(200);
  });

  it('exports a POST proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const res = await POST(
      new Request('http://localhost/messages/m1/repayment', { method: 'POST' }),
      { params: Promise.resolve({ id: 'm1' }) },
    );
    expect(res.status).toBe(200);
  });
});
