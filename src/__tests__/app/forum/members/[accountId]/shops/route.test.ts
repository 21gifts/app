// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/forum/members/[accountId]/shops/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/forum/members/[accountId]/shops', () => {
  it('exports a GET proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/forum/members/acc_1/shops'), {
          params: Promise.resolve({ accountId: 'acc_1' }),
        })
      ).status,
    ).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/members/acc_1/shops');
  });
});
