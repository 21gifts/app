// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/me/recovery-share/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('PUT /me/recovery-share', () => {
  it('forwards the body and Bearer auth to the api path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await PUT(
      new Request('http://localhost/me/recovery-share', {
        method: 'PUT',
        headers: { authorization: 'Bearer token' },
        body: '{}',
      }),
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/me/recovery-share');
    expect(init.method).toBe('PUT');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
  });
});
