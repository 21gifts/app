// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DELETE } from '@/app/me/previous-wallets/[sparkPubkey]/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('DELETE /me/previous-wallets/02ab', () => {
  it('forwards the encoded key, Bearer auth and the empty response', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await DELETE(
      new Request('http://localhost/me/previous-wallets/key', {
        method: 'DELETE',
        headers: { authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ sparkPubkey: 'a/b' }) },
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.test/me/previous-wallets/a%2Fb');
    expect(init.method).toBe('DELETE');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
  });
});
