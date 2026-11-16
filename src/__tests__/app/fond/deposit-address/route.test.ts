// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUT } from '@/app/fond/deposit-address/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

const ADDRESS = 'bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr';

describe('PUT /fond/deposit-address', () => {
  it('forwards Bearer auth and the JSON body to the api path', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const upstreamBody = JSON.stringify({ address: ADDRESS });
    const fetchMock = vi.fn().mockResolvedValue(new Response(upstreamBody, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await PUT(
      new Request('http://localhost/fond/deposit-address', {
        method: 'PUT',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({ address: ADDRESS }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(upstreamBody);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.test/fond/deposit-address');
    expect(init.method).toBe('PUT');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(
      JSON.stringify({ address: ADDRESS }),
    );
  });

  it.each([400, 401, 403, 404, 503])('passes a %i answer through', async (status) => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'x' }), { status })),
    );
    const response = await PUT(
      new Request('http://localhost/fond/deposit-address', {
        method: 'PUT',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: JSON.stringify({ address: ADDRESS }),
      }),
    );
    expect(response.status).toBe(status);
  });
});
