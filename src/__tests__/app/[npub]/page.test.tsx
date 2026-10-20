import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ShopPage, { generateMetadata } from '@/app/[npub]/page';
import { API_FETCH_TIMEOUT_MS } from '@/lib/api-timeout';

/**
 * Client React's `cache` is a pass-through; the server build memoises per
 * request. This stand-in memoises per argument until `newRequest()` clears it,
 * so the tests see the same per-request sharing as the server render.
 */
const requestCaches = vi.hoisted(() => [] as Map<unknown, unknown>[]);

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    cache: <A, R>(fn: (arg: A) => R): ((arg: A) => R) => {
      const memo = new Map<unknown, unknown>();
      requestCaches.push(memo);
      return (arg: A): R => {
        if (!memo.has(arg)) {
          memo.set(arg, fn(arg));
        }
        return memo.get(arg) as R;
      };
    },
  };
});

/** Start a fresh request: drop every per-request memo. */
function newRequest(): void {
  for (const memo of requestCaches) {
    memo.clear();
  }
}

const notFound = vi.fn((): never => {
  throw new Error('NEXT_NOT_FOUND');
});
const permanentRedirect = vi.fn((path: string): never => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
  permanentRedirect: (path: string) => permanentRedirect(path),
}));

vi.mock('@/lib/config', () => ({
  getApiUrl: (): string => 'https://api.test',
}));

vi.mock('@/components/PublicMessageChrome', () => ({
  PublicMessageChrome: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));

vi.mock('@/app/[npub]/ShopScreen', () => ({
  ShopScreen: ({ state, shop }: { state: string; shop?: { name: string } }) => (
    <div data-testid="shop-screen" data-state={state}>
      {shop?.name}
    </div>
  ),
}));

const NPUB = `npub1${'2'.repeat(58)}`;
const OTHER_NPUB = `npub1${'3'.repeat(58)}`;
const HEX = 'a'.repeat(64);
const SHOP = {
  npub: NPUB,
  messageId: '11111111-1111-4111-8111-111111111111',
  name: 'Cafe Luna',
  description: 'Coffee and bitcoin',
  place: {
    lat: 47.37,
    lng: 8.54,
    label: 'Zurich',
    address: {
      street: 'Moon Street',
      houseNumber: '21',
      postalCode: '8000',
      city: 'Zurich',
      country: 'CH',
    },
  },
  photos: [
    {
      url: 'https://api.test/messages/11111111-1111-4111-8111-111111111111/photo.jpg',
      width: 1280,
      height: 960,
    },
  ],
  payUsername: 'luna',
  nip05: 'luna@21.gifts',
  createdAt: '2026-08-28T12:00:00.000Z',
};

function response(status: number, body?: unknown, location?: string): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(location === undefined ? {} : { location }),
    },
  });
}

afterEach(() => {
  newRequest();
  cleanup();
  vi.unstubAllGlobals();
  notFound.mockClear();
  permanentRedirect.mockClear();
});

describe('ShopPage', () => {
  it('rejects an invalid root segment without asking the api', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(ShopPage({ params: Promise.resolve({ npub: 'about-us' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders a successful shop response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { shop: SHOP })));
    render(await ShopPage({ params: Promise.resolve({ npub: NPUB }) }));
    expect(screen.getByTestId('shop-screen').getAttribute('data-state')).toBe('ready');
    expect(screen.getByTestId('shop-screen').textContent).toBe('Cafe Luna');
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/shops/${NPUB}`,
      expect.objectContaining({ cache: 'no-store', redirect: 'manual' }),
    );
  });

  it('uses the existing not-found path for api 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(404, { error: 'Not found' })));
    await expect(ShopPage({ params: Promise.resolve({ npub: NPUB }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it('renders an anonymous gone screen for api 410', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response(410, { error: 'Shop is no longer listed', npub: NPUB })),
    );
    render(await ShopPage({ params: Promise.resolve({ npub: NPUB }) }));
    expect(screen.getByTestId('shop-screen').getAttribute('data-state')).toBe('gone');
    expect(screen.getByTestId('shop-screen').textContent).toBe('');
  });

  it('renders the retryable error for api 503, a bad body, and a network failure', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(503, { error: 'Shops are unavailable' }))
      .mockResolvedValueOnce(response(200, { shop: { nope: true } }))
      .mockRejectedValueOnce(new Error('down'));
    vi.stubGlobal('fetch', fetchMock);
    for (const value of [NPUB, OTHER_NPUB, `npub1${'4'.repeat(58)}`]) {
      newRequest();
      const view = render(await ShopPage({ params: Promise.resolve({ npub: value }) }));
      expect(screen.getByTestId('shop-screen').getAttribute('data-state')).toBe('unavailable');
      view.unmount();
    }
  });

  it('accepts only an exact 200 for an npub and only a 301 for a hex key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(201, { shop: SHOP }))
      .mockResolvedValueOnce(response(200, { shop: SHOP }))
      .mockResolvedValueOnce(response(200, { shop: { ...SHOP, npub: OTHER_NPUB } }));
    vi.stubGlobal('fetch', fetchMock);
    for (const value of [NPUB, HEX, NPUB]) {
      newRequest();
      const view = render(await ShopPage({ params: Promise.resolve({ npub: value }) }));
      expect(screen.getByTestId('shop-screen').getAttribute('data-state')).toBe('unavailable');
      expect(screen.getByTestId('shop-screen').textContent).toBe('');
      view.unmount();
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it('shares one api call between metadata and page within a request', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(response(200, { shop: SHOP }));
    vi.stubGlobal('fetch', fetchMock);
    const params = Promise.resolve({ npub: NPUB });
    const metadata = await generateMetadata({ params });
    render(await ShopPage({ params }));
    expect(metadata.title).toBe('Cafe Luna');
    expect(screen.getByTestId('shop-screen').getAttribute('data-state')).toBe('ready');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    newRequest();
    fetchMock.mockResolvedValueOnce(response(410, { error: 'Shop is no longer listed' }));
    await expect(generateMetadata({ params })).resolves.toEqual({});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('limits the page fetch to 2.5 seconds and shows the retryable error on timeout', async () => {
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() =>
        AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError')),
      );
    const fetchMock = vi.fn((_url: string, init: RequestInit) =>
      init.signal?.aborted === true
        ? Promise.reject(init.signal.reason)
        : Promise.resolve(response(200, { shop: SHOP })),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(await ShopPage({ params: Promise.resolve({ npub: NPUB }) }));
    expect(screen.getByTestId('shop-screen').getAttribute('data-state')).toBe('unavailable');
    expect(timeout).toHaveBeenCalledWith(API_FETCH_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.test/shops/${NPUB}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    timeout.mockRestore();
  });

  it('turns the api hex redirect into a permanent root redirect', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(301, undefined, `/shops/${NPUB}`)));
    await expect(ShopPage({ params: Promise.resolve({ npub: HEX }) })).rejects.toThrow(
      `NEXT_REDIRECT:/${NPUB}`,
    );
    expect(permanentRedirect).toHaveBeenCalledWith(`/${NPUB}`);
  });

  it('shows the retryable error for an unusable or unexpected 301', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(301))
      .mockResolvedValueOnce(response(301, undefined, '/shops/%'))
      .mockResolvedValueOnce(response(301, undefined, '/shops/not-an-npub'))
      .mockResolvedValueOnce(response(301, undefined, `/shops/${NPUB}`));
    vi.stubGlobal('fetch', fetchMock);
    for (const value of [HEX, HEX.replaceAll('a', 'b'), HEX.replaceAll('a', 'c'), NPUB]) {
      newRequest();
      const view = render(await ShopPage({ params: Promise.resolve({ npub: value }) }));
      expect(screen.getByTestId('shop-screen').getAttribute('data-state')).toBe('unavailable');
      view.unmount();
    }
  });
});

describe('shop generateMetadata', () => {
  it('returns empty metadata for an invalid segment without a fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      generateMetadata({ params: Promise.resolve({ npub: 'invalid' }) }),
    ).resolves.toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds canonical metadata with the first photo and a 2.5 second signal', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { shop: SHOP })));
    const metadata = await generateMetadata({ params: Promise.resolve({ npub: NPUB }) });
    expect(metadata).toEqual({
      title: 'Cafe Luna',
      description: 'Coffee and bitcoin',
      alternates: { canonical: `/${NPUB}` },
      openGraph: {
        type: 'website',
        url: `/${NPUB}`,
        siteName: '21.gifts',
        title: 'Cafe Luna',
        description: 'Coffee and bitcoin',
        images: [
          {
            url: SHOP.photos[0]?.url,
            alt: 'Cafe Luna',
            width: 1280,
            height: 960,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: 'Cafe Luna',
        description: 'Coffee and bitcoin',
        images: [{ url: SHOP.photos[0]?.url, alt: 'Cafe Luna' }],
      },
    });
    expect(fetch).toHaveBeenCalledWith(
      `https://api.test/shops/${NPUB}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('uses og.png without photos and omits unknown photo dimensions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, { shop: { ...SHOP, photos: [] } }))
      .mockResolvedValueOnce(
        response(200, {
          shop: {
            ...SHOP,
            photos: [{ url: '/photo.jpg', width: null, height: null }],
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const fallback = await generateMetadata({ params: Promise.resolve({ npub: NPUB }) });
    newRequest();
    expect(fallback.openGraph).toMatchObject({
      images: [
        {
          url: '/og.png',
          width: 1200,
          height: 630,
          alt: '21.gifts — peer-to-peer Bitcoin gifts',
        },
      ],
    });
    const unknownSize = await generateMetadata({ params: Promise.resolve({ npub: NPUB }) });
    expect(unknownSize.openGraph).toMatchObject({
      images: [{ url: '/photo.jpg', alt: 'Cafe Luna' }],
    });
  });

  it('uses the public-note description rules: trimmed, name fallback, 300-unit cut', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(200, { shop: { ...SHOP, description: 'z'.repeat(301) } }))
      .mockResolvedValueOnce(response(200, { shop: { ...SHOP, description: '  ' } }));
    vi.stubGlobal('fetch', fetchMock);
    const long = await generateMetadata({ params: Promise.resolve({ npub: NPUB }) });
    newRequest();
    const cut = `${'z'.repeat(299)}…`;
    expect(long.description).toBe(cut);
    expect(long.openGraph).toMatchObject({ description: cut });
    expect(long.twitter).toMatchObject({ description: cut });
    const blank = await generateMetadata({ params: Promise.resolve({ npub: NPUB }) });
    expect(blank.description).toBe('Cafe Luna on 21.gifts');
    expect(blank.openGraph).toMatchObject({ description: 'Cafe Luna on 21.gifts' });
    expect(blank.twitter).toMatchObject({ description: 'Cafe Luna on 21.gifts' });
  });

  it('inherits root metadata when the shop is not ready', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(503)));
    await expect(generateMetadata({ params: Promise.resolve({ npub: NPUB }) })).resolves.toEqual(
      {},
    );
  });
});
