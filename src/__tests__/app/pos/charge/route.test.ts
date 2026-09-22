// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, POST } from '@/app/pos/charge/route';
import { proxyPosDelete, proxyPosGet, proxyPosPost } from '@/lib/api-proxies';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/pos/charge', () => {
  it('re-exports the point-of-sale proxies', async () => {
    expect(GET).toBe(proxyPosGet);
    expect(POST).toBe(proxyPosPost);
    expect(DELETE).toBe(proxyPosDelete);
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect((await GET(new Request('http://localhost/pos/charge'))).status).toBe(200);
    expect(
      (
        await POST(
          new Request('http://localhost/pos/charge', { method: 'POST', body: '{"amountSats":21}' }),
        )
      ).status,
    ).toBe(200);
    expect(
      (await DELETE(new Request('http://localhost/pos/charge', { method: 'DELETE' }))).status,
    ).toBe(200);
  });
});
