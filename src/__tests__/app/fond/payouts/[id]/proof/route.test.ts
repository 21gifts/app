// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/fond/payouts/[id]/proof/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/fond/payouts/[id]/proof', () => {
  it('POST forwards the encoded id, Bearer auth, and the preimage body', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      new Request('http://localhost/fond/payouts/x/proof', {
        method: 'POST',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({ preimage: 'ab' }),
      }),
      { params: Promise.resolve({ id: 'a/b' }) },
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.test/fond/payouts/a%2Fb/proof');
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"preimage":"ab"}');
  });
});
