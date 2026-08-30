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
    const request = new Request('http://localhost/me?x=1', {
      headers: {
        authorization: 'Bearer tok',
        origin: 'https://21.gifts',
        'user-agent': 'Copay',
        'x-ignored': 'no',
      },
    });

    const res = await proxyApiRequest(request, '/me');

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(await res.json()).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(`${API}/me?x=1`);
    const headers = init.headers as Headers;
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('origin')).toBe('https://21.gifts');
    expect(headers.get('user-agent')).toBe('Copay');
    expect(headers.get('x-ignored')).toBeNull();
  });

  it('forwards a POST body as a stream with duplex half', async () => {
    const fetchMock = stubFetch(new Response('{}', { status: 200 }));
    const body = JSON.stringify({ address: 'a@b.com' });
    const request = new Request('http://localhost/me/lightning-address', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(body.length),
        'transfer-encoding': 'chunked',
      },
      body,
    });
    const originalBody = request.body;

    await proxyApiRequest(request, '/me/lightning-address');

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit & { duplex?: string }];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(originalBody);
    expect(init.duplex).toBe('half');
    const headers = init.headers as Headers;
    expect(headers.get('content-length')).toBe(String(body.length));
    expect(headers.get('transfer-encoding')).toBeNull();
  });

  it('forwards Range on GET and still drops x-ignored', async () => {
    const fetchMock = stubFetch(
      new Response('ab', { status: 206, headers: { 'content-type': 'video/mp4' } }),
    );
    const request = new Request('http://localhost/messages/m1/video.mp4', {
      headers: {
        Range: 'bytes=0-1',
        'x-ignored': 'no',
      },
    });

    await proxyApiRequest(request, '/messages/m1/video.mp4');

    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get('range')).toBe('bytes=0-1');
    expect(headers.get('x-ignored')).toBeNull();
  });

  it('copies range and cache response headers from upstream', async () => {
    stubFetch(
      new Response('chunk', {
        status: 206,
        headers: {
          'content-type': 'video/mp4',
          'content-length': '5',
          'content-range': 'bytes 0-4/100',
          'accept-ranges': 'bytes',
          'cache-control': 'public, max-age=60',
          'content-disposition': 'inline',
        },
      }),
    );

    const res = await proxyApiRequest(
      new Request('http://localhost/messages/m1/video.mp4', {
        headers: { Range: 'bytes=0-4' },
      }),
      '/messages/m1/video.mp4',
    );

    expect(res.status).toBe(206);
    expect(res.headers.get('content-type')).toBe('video/mp4');
    expect(res.headers.get('content-length')).toBe('5');
    expect(res.headers.get('content-range')).toBe('bytes 0-4/100');
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    expect(res.headers.get('content-disposition')).toBe('inline');
  });

  it('returns 502 JSON when the api URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const res = await proxyApiRequest(new Request('http://localhost/me'), '/me');
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'Upstream api unreachable' });
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
