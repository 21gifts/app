import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translateNote } from '@/lib/note-translate';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTranslateAvailable', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function loadAvailable(): Promise<
    (typeof import('@/lib/note-translate'))['fetchTranslateAvailable']
  > {
    const mod = await import('@/lib/note-translate');
    return mod.fetchTranslateAvailable;
  }

  it('caches a successful availability request for the module lifetime', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ available: true }), {
          status: 200,
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const fetchAvailable = await loadAvailable();

    await expect(fetchAvailable()).resolves.toBe(true);
    await expect(fetchAvailable()).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/translate');
  });

  it('shares one in-flight availability request between concurrent callers', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const fetchAvailable = await loadAvailable();

    const first = fetchAvailable();
    const second = fetchAvailable();
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.(new Response(JSON.stringify({ available: true }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
  });

  it('returns false for a non-success response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));
    const fetchAvailable = await loadAvailable();
    await expect(fetchAvailable()).resolves.toBe(false);
  });

  it('returns false when the request or JSON parsing fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const fetchOffline = await loadAvailable();
    await expect(fetchOffline()).resolves.toBe(false);

    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not json', { status: 200 })));
    const fetchInvalidJson = await loadAvailable();
    await expect(fetchInvalidJson()).resolves.toBe(false);
  });

  it.each([null, 'yes', {}, { available: false }])(
    'returns false for invalid availability payload %j',
    async (body) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
      );
      const fetchAvailable = await loadAvailable();
      await expect(fetchAvailable()).resolves.toBe(false);
    },
  );
});

describe('translateNote', () => {
  it('posts text and target and returns translatedText', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ translatedText: 'Danke euch beiden.' }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(translateNote('Thank you both — that helps.', 'de')).resolves.toBe(
      'Danke euch beiden.',
    );
    expect(fetchMock).toHaveBeenCalledWith('/translate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Thank you both — that helps.', target: 'de' }),
    });
  });

  it('throws when the route returns a non-success response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })));
    await expect(translateNote('Hallo zusammen und guten Morgen', 'en')).rejects.toThrow(
      'Translation request failed',
    );
  });

  it.each([null, 'translated', {}, { translatedText: 21 }])(
    'throws when translatedText is missing or invalid in %j',
    async (body) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })),
      );
      await expect(translateNote('Hallo zusammen und guten Morgen', 'en')).rejects.toThrow(
        'Translation response is invalid',
      );
    },
  );
});
