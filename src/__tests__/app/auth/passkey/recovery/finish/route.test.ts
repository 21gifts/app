// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/auth/passkey/recovery/finish/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('POST /auth/passkey/recovery/finish', () => {
  it('forwards the body and the build header to the api path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      new Request('http://localhost/auth/passkey/recovery/finish', {
        method: 'POST',
        headers: { 'x-app-build': 'build-1' },
        body: '{"challengeId":"ch"}',
      }),
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/auth/passkey/recovery/finish');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('x-app-build')).toBe('build-1');
  });
});
