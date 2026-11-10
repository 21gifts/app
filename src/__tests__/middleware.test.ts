import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CSP_SOURCES } from '@/lib/csp';
import { config, middleware } from '@/middleware';

afterEach(() => {
  vi.unstubAllEnvs();
});

/**
 * Nonce named in a policy.
 *
 * @param policy - Policy text.
 * @returns The nonce, or `undefined`.
 */
function nonceOf(policy: string | null): string | undefined {
  return policy?.match(/'nonce-([^']+)'/)?.[1];
}

const responses = vi.hoisted(() => {
  function response(init?: { request?: { headers?: Headers } }): {
    cookies: { set: ReturnType<typeof vi.fn> };
    headers: { set: ReturnType<typeof vi.fn>; get: (name: string) => string | null };
  } {
    const store = new Map<string, string>();
    const requestHeaders = init?.request?.headers;
    if (requestHeaders instanceof Headers) {
      requestHeaders.forEach((value, key) => {
        store.set(`x-middleware-request-${key.toLowerCase()}`, value);
      });
    }
    return {
      cookies: { set: vi.fn() },
      headers: {
        set: vi.fn((name: string, value: string) => {
          store.set(name.toLowerCase(), value);
        }),
        get: (name: string) => store.get(name.toLowerCase()) ?? null,
      },
    };
  }
  return { next: vi.fn(response), rewrite: vi.fn(response), redirect: vi.fn(response) };
});

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return { ...actual, NextResponse: responses };
});

function requestFor(url: string, headers: Record<string, string> = {}, search = ''): NextRequest {
  const parsed = new URL(url);
  return {
    nextUrl: {
      pathname: parsed.pathname,
      hostname: parsed.hostname,
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

  it('stores a cookie when a document request is a prerender', () => {
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
    expect(response.cookies.set).toHaveBeenCalledWith('locale', 'es', {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
      secure: true,
    });
  });

  it('does not store a cookie for a document prefetch that is not a prerender', () => {
    const response = middleware(
      requestFor('https://21.gifts/de/about', {
        'sec-fetch-dest': 'document',
        'sec-purpose': 'prefetch',
      }),
    ) as unknown as { cookies: { set: ReturnType<typeof vi.fn> } };
    const [destination, options] = responses.rewrite.mock.lastCall as unknown as [
      URL,
      { request: { headers: Headers } },
    ];
    expect(destination.pathname).toBe('/about');
    expect(options.request.headers.get('x-21gifts-public-locale')).toBe('de');
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
      headers?: { get: (name: string) => string | null };
    };
    const [destination] = responses.redirect.mock.lastCall as unknown as [URL];
    expect(destination.toString()).toBe('https://21.gifts/shops#map');
    expect(response.headers?.get('location') ?? destination.toString()).toBe(
      'https://21.gifts/shops#map',
    );
    expect(response.headers?.get('content-security-policy-report-only') ?? null).toBeNull();
    expect(response.cookies.set).not.toHaveBeenCalled();
  });

  it('keeps a pin query on the shops map', () => {
    const request = requestFor('https://21.gifts/map?pin=m-pin', {}, '?pin=m-pin');
    middleware(request);
    const [destination] = responses.redirect.mock.lastCall as unknown as [URL];
    expect(destination.toString()).toBe('https://21.gifts/shops?pin=m-pin#map');
  });

  it('sends the policy report-only by default, with the reporting endpoint', () => {
    const response = middleware(new NextRequest('https://21.gifts/welcome'));
    const policy = response.headers.get('content-security-policy-report-only');
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain('report-uri /monitoring/csp');
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('reporting-endpoints')).toBe('csp="/monitoring/csp"');
  });

  it.each([
    ['21.gifts', 'https://api.opencryptopay.io', 'https://dev-api.opencryptopay.io'],
    ['www.21.gifts', 'https://api.opencryptopay.io', 'https://dev-api.opencryptopay.io'],
    ['preview.example', 'https://dev-api.opencryptopay.io', 'https://api.opencryptopay.io'],
  ])('selects the photo origin for %s', (hostname, allowed, disallowed) => {
    const response = middleware(new NextRequest(`https://${hostname}/welcome`));
    const policy = response.headers.get('content-security-policy-report-only');
    const images = policy?.split('; ').find((directive) => directive.startsWith('img-src '));
    expect(images?.split(' ')).toContain(allowed);
    expect(images?.split(' ')).not.toContain(disallowed);
    expect(images?.split(' ').slice(1)).toEqual(
      CSP_SOURCES['img-src']?.filter((source) => source !== disallowed),
    );
    expect(response.headers.get('x-middleware-request-content-security-policy-report-only')).toBe(
      policy,
    );
  });

  it.each<{ headers: Record<string, string>; production: boolean }>([
    { headers: { 'x-forwarded-host': '21.gifts', host: 'internal.example' }, production: true },
    { headers: { 'x-forwarded-host': '21.gifts, proxy' }, production: true },
    {
      headers: { 'x-forwarded-host': ' 21.GIFTS:443, proxy', host: 'internal.example' },
      production: true,
    },
    { headers: { host: 'www.21.gifts:443' }, production: true },
    { headers: { 'x-forwarded-host': 'preview.example', host: '21.gifts' }, production: false },
    { headers: {}, production: false },
  ])('uses the public host headers for the photo policy: $headers', ({ headers, production }) => {
    const response = middleware(requestFor('https://internal.example/welcome', headers));
    const policy = response.headers.get('content-security-policy-report-only') ?? '';
    const images = policy.split('; ').find((directive) => directive.startsWith('img-src '));
    expect(images?.split(' ')).toContain(
      production ? 'https://api.opencryptopay.io' : 'https://dev-api.opencryptopay.io',
    );
    expect(images?.split(' ')).not.toContain(
      production ? 'https://dev-api.opencryptopay.io' : 'https://api.opencryptopay.io',
    );
  });

  it('enforces the policy when CSP_MODE is enforce', () => {
    vi.stubEnv('CSP_MODE', 'enforce');
    const response = middleware(new NextRequest('https://21.gifts/welcome'));
    expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(response.headers.get('content-security-policy-report-only')).toBeNull();
  });

  it('passes the same nonce and policy on to the page', () => {
    const response = middleware(new NextRequest('https://21.gifts/welcome'));
    const policy = response.headers.get('content-security-policy-report-only');
    const nonce = nonceOf(policy);
    expect(nonce).toBeDefined();
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(response.headers.get('x-middleware-request-content-security-policy-report-only')).toBe(
      policy,
    );
  });

  it('uses a new nonce per request', () => {
    const first = middleware(new NextRequest('https://21.gifts/welcome'));
    const second = middleware(new NextRequest('https://21.gifts/welcome'));
    expect(nonceOf(first.headers.get('content-security-policy-report-only'))).not.toBe(
      nonceOf(second.headers.get('content-security-policy-report-only')),
    );
  });

  it('matches /map and pages, not build assets or public files', () => {
    const [map, pages] = config.matcher as [string, string];
    expect(map).toBe('/map');
    const pattern = new RegExp(`^${pages}$`);
    for (const path of ['/', '/welcome', '/members/acc_1', '/monitoring/csp', '/_next/data/x']) {
      expect(pattern.test(path)).toBe(true);
    }
    for (const path of [
      '/_next/static/chunks/a.js',
      '/_next/image',
      '/sw.js',
      '/favicon.ico',
      '/favicon.svg',
      '/apple-touch-icon.png',
      '/icon-192.png',
      '/icon-512.png',
      '/og.png',
      '/robots.txt',
      '/sitemap.xml',
      '/handbook-images/a.png',
      '/happyland/a.jpg',
    ]) {
      expect(pattern.test(path)).toBe(false);
    }
  });
});
