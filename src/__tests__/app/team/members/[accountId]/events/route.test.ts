// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/team/members/[accountId]/events/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/team/members/[accountId]/events', () => {
  it('exports a GET proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/team/members/acc_1/events?before=c1'), {
          params: Promise.resolve({ accountId: 'acc_1' }),
        })
      ).status,
    ).toBe(200);
    const url = fetchMock.mock.calls[0]?.[0] as URL;
    expect(url.pathname).toBe('/team/members/acc_1/events');
    expect(url.search).toBe('?before=c1');
  });
});
