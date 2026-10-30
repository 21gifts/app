// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DELETE, PUT } from '@/app/me/held-shares/[id]/route';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

describe('/me/held-shares/:id', () => {
  it('PUT forwards the encoded id, Bearer auth and the JSON body', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await PUT(
      new Request('http://localhost/me/held-shares/id', {
        method: 'PUT',
        headers: { authorization: 'Bearer token', 'content-type': 'application/json' },
        body: '{"ciphertext":"AQID"}',
      }),
      { params: Promise.resolve({ id: 'a/b' }) },
    );
    expect(response.status).toBe(201);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe('https://api.test/me/held-shares/a%2Fb');
    expect(init.method).toBe('PUT');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe('{"ciphertext":"AQID"}');
  });

  it('DELETE forwards the id, Bearer auth and the empty response', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://api.test';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const response = await DELETE(
      new Request('http://localhost/me/held-shares/id', {
        method: 'DELETE',
        headers: { authorization: 'Bearer token' },
      }),
      { params: Promise.resolve({ id: 'f'.repeat(32) }) },
    );
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe(`https://api.test/me/held-shares/${'f'.repeat(32)}`);
    expect(init.method).toBe('DELETE');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token');
  });
});
