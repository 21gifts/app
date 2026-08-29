// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/messages/[id]/invoice/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/messages/[id]/invoice', () => {
  it('exports a POST proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const res = await POST(new Request('http://localhost/messages/m1/invoice', { method: 'POST' }), {
      params: Promise.resolve({ id: 'm1' }),
    });
    expect(res.status).toBe(200);
  });
});
