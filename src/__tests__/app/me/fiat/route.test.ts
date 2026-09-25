// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/me/fiat/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/me/fiat', () => {
  it('returns 401 when the bearer is missing', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    const res = await POST(new Request('http://localhost/me/fiat', { method: 'POST' }));
    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer is blank', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    const res = await POST(
      new Request('http://localhost/me/fiat', {
        method: 'POST',
        headers: { authorization: 'Bearer ' },
      }),
    );
    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('proxies a bearer request', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    const res = await POST(
      new Request('http://localhost/me/fiat', {
        method: 'POST',
        headers: { authorization: 'Bearer tok' },
      }),
    );
    expect(res.status).toBe(200);
  });
});
