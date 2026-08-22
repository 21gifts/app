// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { proxyApiRequest } from '@/lib/api-proxy';

const API = 'https://api.test';

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_API_URL;
});

beforeEach(() => {
  process.env.NEXT_PUBLIC_API_URL = API;
});

/** Installs a `fetch` mock that resolves with the given Response. */
function stubFetch(response: Response): Mock {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('proxyApiRequest', () => {
  it('forwards GET query string and selected headers', async () => {
    const fetchMock = stubFetch(
      new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } }),
    );
    const request = new Request('http://localhost/auth/lnurl?k1=ab', {
      headers: { authorization: 'Bearer tok', 'x-poll-token': 'pt', 'x-ignored': 'no' },
    });

    const res = await proxyApiRequest(request, '/auth/lnurl');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${API}/auth/lnurl?k1=ab`);
    const headers = init.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('x-poll-token')).toBe('pt');
    expect(headers.get('x-ignored')).toBeNull();
  });

  it('forwards a POST body', async () => {
    const fetchMock = stubFetch(new Response('{}', { status: 200 }));
    const body = JSON.stringify({ address: 'a@b.com' });
    const request = new Request('http://localhost/me/lightning-address', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    await proxyApiRequest(request, '/me/lightning-address');

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(body);
  });

  it('returns 502 JSON when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const res = await proxyApiRequest(new Request('http://localhost/me'), '/me');

    expect(res.status).toBe(502);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ error: 'Upstream api unreachable' });
  });

  it('omits content-type on the client response when upstream has none', async () => {
    stubFetch(new Response(null, { status: 204 }));
    const res = await proxyApiRequest(new Request('http://localhost/me'), '/me');
    expect(res.status).toBe(204);
    expect(res.headers.get('content-type')).toBeNull();
  });
});
