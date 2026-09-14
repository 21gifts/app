// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getTranslateUpstream,
  proxyTranslateGet,
  proxyTranslatePost,
} from '@/lib/translate-upstream';

const originalTranslateUrl = process.env.TRANSLATE_URL;
const originalTranslateApiKey = process.env.TRANSLATE_API_KEY;

function restoreEnv(name: 'TRANSLATE_URL' | 'TRANSLATE_API_KEY', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function requestWith(body: string | object, headers?: HeadersInit): Request {
  const requestHeaders = new Headers(headers);
  requestHeaders.set('content-type', 'application/json');
  return new Request('http://localhost/translate', {
    method: 'POST',
    headers: requestHeaders,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

afterEach(() => {
  restoreEnv('TRANSLATE_URL', originalTranslateUrl);
  restoreEnv('TRANSLATE_API_KEY', originalTranslateApiKey);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('getTranslateUpstream', () => {
  it.each([undefined, '', '   ', 'not a url', 'ftp://translate.test'])(
    'returns null for disabled or invalid URL %j',
    (value) => {
      if (value === undefined) {
        delete process.env.TRANSLATE_URL;
      } else {
        process.env.TRANSLATE_URL = value;
      }
      expect(getTranslateUpstream()).toBeNull();
    },
  );

  it('accepts HTTP and appends the translate path', () => {
    process.env.TRANSLATE_URL = 'http://127.0.0.1:3001';
    expect(getTranslateUpstream()).toEqual({
      url: new URL('http://127.0.0.1:3001/translate'),
      apiKey: null,
    });
  });

  it('accepts HTTPS, preserves a base path, and treats an empty key as absent', () => {
    process.env.TRANSLATE_URL = 'https://translate.test/api/';
    process.env.TRANSLATE_API_KEY = '';
    expect(getTranslateUpstream()).toEqual({
      url: new URL('https://translate.test/api/translate'),
      apiKey: null,
    });
  });

  it('returns a configured API key', () => {
    process.env.TRANSLATE_URL = 'https://translate.test/api';
    process.env.TRANSLATE_API_KEY = 'secret-key';
    expect(getTranslateUpstream()).toEqual({
      url: new URL('https://translate.test/api/translate'),
      apiKey: 'secret-key',
    });
  });
});

describe('proxyTranslateGet', () => {
  it('reports false without contacting an upstream when configuration is absent', async () => {
    delete process.env.TRANSLATE_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = proxyTranslateGet();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports true without contacting an upstream when configuration is valid', async () => {
    process.env.TRANSLATE_URL = 'https://translate.test';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = proxyTranslateGet();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ available: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('proxyTranslatePost', () => {
  it('returns 503 when translation is not configured', async () => {
    delete process.env.TRANSLATE_URL;
    const response = await proxyTranslatePost(
      requestWith({ text: 'Hallo zusammen', target: 'en' }),
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'Translate is not configured' });
  });

  it.each([
    ['invalid JSON', '{'],
    ['empty body', {}],
    ['overlong text', { text: 'x'.repeat(501), target: 'en' }],
    ['bad target', { text: 'Hallo zusammen', target: 'fr' }],
  ])('returns 400 for %s', async (_label, body) => {
    process.env.TRANSLATE_URL = 'https://translate.test';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxyTranslatePost(requestWith(body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Invalid body' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts exactly 500 characters and forwards only content-type', async () => {
    process.env.TRANSLATE_URL = 'https://translate.test';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ translatedText: 'translated' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const text = 'x'.repeat(500);
    const response = await proxyTranslatePost(
      requestWith(
        { text, target: 'en' },
        { authorization: 'Bearer incoming-secret', 'x-ignored': 'also-secret' },
      ),
    );

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('https://translate.test/translate');
    expect(init.method).toBe('POST');
    expect([...new Headers(init.headers).entries()]).toEqual([
      ['content-type', 'application/json'],
    ]);
    expect(JSON.parse(String(init.body))).toEqual({
      q: text,
      source: 'auto',
      target: 'en',
      format: 'text',
    });
  });

  it('maps fil to tl and includes a configured API key', async () => {
    process.env.TRANSLATE_URL = 'http://127.0.0.1:3001';
    process.env.TRANSLATE_API_KEY = 'upstream-key';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ translatedText: 'May ekstrang sats ba kayo?' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await proxyTranslatePost(
      requestWith({ text: 'Does anyone have spare sats this week?', target: 'fil' }),
    );

    await expect(response.json()).resolves.toEqual({
      translatedText: 'May ekstrang sats ba kayo?',
    });
    const [, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      q: 'Does anyone have spare sats this week?',
      source: 'auto',
      target: 'tl',
      format: 'text',
      api_key: 'upstream-key',
    });
  });

  it('returns 502 when the upstream network request rejects', async () => {
    process.env.TRANSLATE_URL = 'https://translate.test';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const response = await proxyTranslatePost(
      requestWith({ text: 'Hallo zusammen', target: 'en' }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Translate upstream unreachable' });
  });

  it('aborts an upstream request after the timeout and returns 502', async () => {
    process.env.TRANSLATE_URL = 'https://translate.test';
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn((_input: URL | RequestInfo, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    );
    const pending = proxyTranslatePost(requestWith({ text: 'Hallo zusammen', target: 'en' }));
    await vi.advanceTimersByTimeAsync(15_000);
    const response = await pending;
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Translate upstream unreachable' });
  });

  it('maps a non-success upstream response to 502 without leaking its body', async () => {
    process.env.TRANSLATE_URL = 'https://translate.test';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private upstream detail', { status: 429 })),
    );
    const response = await proxyTranslatePost(
      requestWith({ text: 'Hallo zusammen', target: 'en' }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Translate upstream failed' });
  });

  it('maps invalid upstream JSON to 502', async () => {
    process.env.TRANSLATE_URL = 'https://translate.test';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    const response = await proxyTranslatePost(
      requestWith({ text: 'Hallo zusammen', target: 'en' }),
    );
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Translate upstream failed' });
  });

  it.each([{}, { translatedText: '' }])(
    'maps missing or empty translatedText payload %j to 502',
    async (body) => {
      process.env.TRANSLATE_URL = 'https://translate.test';
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
      );
      const response = await proxyTranslatePost(
        requestWith({ text: 'Hallo zusammen', target: 'en' }),
      );
      expect(response.status).toBe(502);
      await expect(response.json()).resolves.toEqual({ error: 'Translate upstream failed' });
    },
  );
});
