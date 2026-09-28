import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const responses = vi.hoisted(() => ({ next: vi.fn(), rewrite: vi.fn(), redirect: vi.fn() }));

vi.mock('next/server', () => ({ NextResponse: responses }));

describe('public language middleware', () => {
  it('rewrites a language page and passes its locale to server components', () => {
    const request = {
      nextUrl: {
        pathname: '/de/about',
        clone: () => new URL('https://21.gifts/de/about'),
      },
      headers: new Headers({ Cookie: 'locale=fil' }),
    } as unknown as NextRequest;
    middleware(request);
    const [destination, options] = responses.rewrite.mock.lastCall as [
      URL,
      { request: { headers: Headers } },
    ];
    expect(destination.pathname).toBe('/about');
    expect(options.request.headers.get('x-21gifts-public-locale')).toBe('de');
    expect(options.request.headers.get('cookie')).toBe('locale=fil');
  });

  it('leaves other routes to the normal router', () => {
    const request = { nextUrl: { pathname: '/de/login' } } as NextRequest;
    middleware(request);
    expect(responses.next).toHaveBeenCalledTimes(1);
  });
});

describe('map redirect', () => {
  it('sends /map to the shops map', () => {
    const request = {
      nextUrl: { pathname: '/map', search: '' },
      url: 'https://21.gifts/map',
    } as unknown as NextRequest;
    middleware(request);
    const [destination] = responses.redirect.mock.lastCall as [URL];
    expect(destination.toString()).toBe('https://21.gifts/shops#map');
  });

  it('keeps a pin query on the shops map', () => {
    const request = {
      nextUrl: { pathname: '/map', search: '?pin=m-pin' },
      url: 'https://21.gifts/map?pin=m-pin',
    } as unknown as NextRequest;
    middleware(request);
    const [destination] = responses.redirect.mock.lastCall as [URL];
    expect(destination.toString()).toBe('https://21.gifts/shops?pin=m-pin#map');
  });
});
