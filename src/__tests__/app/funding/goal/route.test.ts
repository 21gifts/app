// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/funding/goal/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('GET /funding/goal', () => {
  it('is the funding goal proxy and forwards Authorization', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const request = new Request('http://localhost/funding/goal', {
      headers: { authorization: 'Bearer sess-1' },
    });
    expect((await GET(request)).status).toBe(200);
    expect((fetchMock.mock.calls[0]?.[0] as URL).pathname).toBe('/funding/goal');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe('Bearer sess-1');
  });
});
