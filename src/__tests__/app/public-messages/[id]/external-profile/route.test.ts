// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/public-messages/[id]/external-profile/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/public-messages/[id]/external-profile', () => {
  it('exports a GET proxy that forwards the id without requiring auth', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/public-messages/m1/external-profile'), {
          params: Promise.resolve({ id: 'm1' }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/messages/m1/external-profile');
  });
});
