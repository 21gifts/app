// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DELETE, POST } from '@/app/me/push-subscriptions/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/me/push-subscriptions', () => {
  it('exports POST and DELETE proxies', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    expect(
      (
        await POST(
          new Request('http://localhost/me/push-subscriptions', { method: 'POST', body: '{}' }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await DELETE(
          new Request('http://localhost/me/push-subscriptions', {
            method: 'DELETE',
            body: '{}',
          }),
        )
      ).status,
    ).toBe(200);
  });
});
