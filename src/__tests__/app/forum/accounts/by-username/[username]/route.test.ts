// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/forum/accounts/by-username/[username]/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/forum/accounts/by-username/[username]', () => {
  it('exports a GET proxy', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(
      (
        await GET(new Request('http://localhost/forum/accounts/by-username/ada'), {
          params: Promise.resolve({ username: 'ada' }),
        })
      ).status,
    ).toBe(200);
    const target = fetchMock.mock.calls[0]?.[0] as URL;
    expect(target.pathname).toBe('/accounts/by-username/ada');
  });
});
