import { describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { middleware } from '@/middleware';

const responses = vi.hoisted(() => {
  function response(): { cookies: { set: ReturnType<typeof vi.fn> } } {
    return { cookies: { set: vi.fn() } };
  }
  return { next: vi.fn(response), rewrite: vi.fn(response), redirect: vi.fn(response) };
});

vi.mock('next/server', () => ({ NextResponse: responses }));

function requestFor(url: string, headers: Record<string, string> = {}, search = ''): NextRequest {
  const parsed = new URL(url);
  return {
    nextUrl: {
      pathname: parsed.pathname,
      protocol: parsed.protocol,
      search,
      clone: () => new URL(url),
    },
    url,
    headers: new Headers(headers),
  } as unknown as NextRequest;
}

describe('public language middleware', () => {
  it('rewrites a language page and passes its locale to server components', () => {
    const request = {
      nextUrl: {
        pathname: '/de/about',
        protocol: 'https:',
        clone: () => new URL('https://21.gifts/de/about'),
      },
      headers: new Headers({ Cookie: 'locale=fil' }),
    } as unknown as NextRequest;
    middleware(request);
    const [destination, options] = responses.rewrite.mock.lastCall as unknown as [
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

  it('stores the URL language with a secure cookie on https', () => {
    const response = middleware(requestFor('https://21.gifts/de/about')) as unknown as {
      cookies: { set: ReturnType<typeof vi.fn> };
    };
    expect(response.cookies.set).toHaveBeenCalledWith('locale', 'de', {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      secure: true,
    });
  });

  it('stores an insecure cookie on plain http without a forwarded protocol', () => {
    const response = middleware(requestFor('http://21.gifts/de/about')) as unknown as {
      cookies: { set: ReturnType<typeof vi.fn> };
    };
    expect(response.cookies.set).toHaveBeenCalledWith(
      'locale',
      'de',
      expect.objectContaining({ secure: false }),
    );
  });

  it('treats a forwarded https protocol as secure on an http URL', () => {
    const response = middleware(
      requestFor('http://21.gifts/es/rules', { 'x-forwarded-proto': 'https' }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    expect(response.cookies.set).toHaveBeenCalledWith(
      'locale',
      'es',
      expect.objectContaining({ secure: true, path: '/', maxAge: 31536000, sameSite: 'lax' }),
    );
  });

  it('uses the first forwarded protocol when several are listed', () => {
    const secure = middleware(
      requestFor('http://21.gifts/fil', { 'x-forwarded-proto': 'https, http' }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    expect(secure.cookies.set).toHaveBeenCalledWith(
      'locale',
      'fil',
      expect.objectContaining({ secure: true }),
    );
    const insecure = middleware(
      requestFor('http://21.gifts/en/donate', { 'x-forwarded-proto': 'http, https' }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    expect(insecure.cookies.set).toHaveBeenCalledWith(
      'locale',
      'en',
      expect.objectContaining({ secure: false }),
    );
  });

  it('trims the first forwarded protocol', () => {
    const response = middleware(
      requestFor('http://21.gifts/de', { 'x-forwarded-proto': ' https, http' }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    expect(response.cookies.set).toHaveBeenCalledWith(
      'locale',
      'de',
      expect.objectContaining({ secure: true }),
    );
  });

  it('stores a cookie when the browser opens the language URL as a document', () => {
    const response = middleware(
      requestFor('https://21.gifts/en/donate', { 'sec-fetch-dest': 'document' }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    const [destination, options] = responses.rewrite.mock.lastCall as unknown as [
      URL,
      { request: { headers: Headers } },
    ];
    expect(destination.pathname).toBe('/donate');
    expect(options.request.headers.get('x-21gifts-public-locale')).toBe('en');
    expect(response.cookies.set).toHaveBeenCalledWith('locale', 'en', {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      secure: true,
    });
  });

  it('stores a cookie when sec-fetch-dest is absent', () => {
    const response = middleware(requestFor('https://21.gifts/fil/rules')) as unknown as {
      cookies: { set: ReturnType<typeof vi.fn> };
    };
    const [destination, options] = responses.rewrite.mock.lastCall as unknown as [
      URL,
      { request: { headers: Headers } },
    ];
    expect(destination.pathname).toBe('/rules');
    expect(options.request.headers.get('x-21gifts-public-locale')).toBe('fil');
    expect(response.cookies.set).toHaveBeenCalledWith('locale', 'fil', {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      secure: true,
    });
  });

  it('rewrites an in-app fetch without storing a cookie', () => {
    const response = middleware(
      requestFor('https://21.gifts/en/donate', { 'sec-fetch-dest': 'empty' }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    const [destination, options] = responses.rewrite.mock.lastCall as unknown as [
      URL,
      { request: { headers: Headers } },
    ];
    expect(destination.pathname).toBe('/donate');
    expect(options.request.headers.get('x-21gifts-public-locale')).toBe('en');
    expect(response.cookies.set).not.toHaveBeenCalled();
  });

  it('does not store a cookie when a document request is also a prefetch', () => {
    const response = middleware(
      requestFor('https://21.gifts/es', {
        'sec-fetch-dest': 'document',
        'sec-purpose': 'prefetch;prerender',
      }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    const [destination, options] = responses.rewrite.mock.lastCall as unknown as [
      URL,
      { request: { headers: Headers } },
    ];
    expect(destination.pathname).toBe('/');
    expect(options.request.headers.get('x-21gifts-public-locale')).toBe('es');
    expect(response.cookies.set).not.toHaveBeenCalled();
  });

  it('does not store a cookie when purpose is Prefetch', () => {
    const response = middleware(
      requestFor('https://21.gifts/de/about', { purpose: 'Prefetch' }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    const [destination, options] = responses.rewrite.mock.lastCall as unknown as [
      URL,
      { request: { headers: Headers } },
    ];
    expect(destination.pathname).toBe('/about');
    expect(options.request.headers.get('x-21gifts-public-locale')).toBe('de');
    expect(response.cookies.set).not.toHaveBeenCalled();
  });

  it('does not store a cookie for a language prefix that is not a public page', () => {
    const response = middleware(requestFor('https://21.gifts/de/login')) as unknown as {
      cookies: { set: ReturnType<typeof vi.fn> };
    };
    expect(responses.next).toHaveBeenCalled();
    expect(response.cookies.set).not.toHaveBeenCalled();
  });
});

describe('map redirect', () => {
  it('sends /map to the shops map', () => {
    const response = middleware(requestFor('https://21.gifts/map')) as unknown as {
      cookies: { set: ReturnType<typeof vi.fn> };
    };
    const [destination] = responses.redirect.mock.lastCall as unknown as [URL];
    expect(destination.toString()).toBe('https://21.gifts/shops#map');
    expect(response.cookies.set).not.toHaveBeenCalled();
  });

  it('keeps a pin query on the shops map', () => {
    const request = requestFor('https://21.gifts/map?pin=m-pin', {}, '?pin=m-pin');
    middleware(request);
    const [destination] = responses.redirect.mock.lastCall as unknown as [URL];
    expect(destination.toString()).toBe('https://21.gifts/shops?pin=m-pin#map');
  });
});
