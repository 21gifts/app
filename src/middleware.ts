import { NextResponse, type NextRequest } from 'next/server';
import { LOCALE_COOKIE } from '@/lib/locale';
import { parseLocalizedPublicPath } from '@/lib/public-locale-path';

const LOCALE_COOKIE_MAX_AGE = 31536000;

/** True when the request URL or the first `x-forwarded-proto` value is https. */
function requestIsHttps(request: NextRequest): boolean {
  if (request.nextUrl.protocol === 'https:') return true;
  const forwarded = request.headers.get('x-forwarded-proto');
  if (forwarded === null) return false;
  const comma = forwarded.indexOf(',');
  const first = (comma === -1 ? forwarded : forwarded.slice(0, comma)).trim();
  return first === 'https';
}

/** True when the browser opens this request as a page, not a prefetch or in-app fetch. */
function opensDocument(request: NextRequest): boolean {
  const purpose = request.headers.get('purpose') ?? '';
  const secPurpose = request.headers.get('sec-purpose') ?? '';
  if (`${purpose} ${secPurpose}`.toLowerCase().includes('prefetch')) return false;
  const dest = request.headers.get('sec-fetch-dest');
  return dest === null || dest === 'document';
}

/**
 * Route public language URLs, remember that language, and keep `/map` working.
 *
 * A `/:locale(en|de|es|fil)` path for `/`, `/about`, `/donate`, or `/rules`
 * is rewritten onto the existing page. The locale is passed as the
 * `x-21gifts-public-locale` request header. The `locale` cookie is set when
 * the browser opens that language URL as a page (`sec-fetch-dest` is
 * `document`, or the header is absent). Prefetches do not set it: `purpose`
 * or `sec-purpose` contains `prefetch` (any case). In-app navigations do not
 * set it either: `sec-fetch-dest` is present and is not `document`. The
 * rewrite and `x-21gifts-public-locale` stay the same in every case. `/map`
 * keeps its query string and redirects to `/shops#map`. Other paths, including
 * `/de/login`, are left untouched and do not write the cookie.
 *
 * @param request - The incoming request.
 * @returns The locale rewrite, the shops redirect, or the untouched response.
 */
export function middleware(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/map') {
    const destination = new URL('/shops', request.url);
    destination.search = request.nextUrl.search;
    destination.hash = 'map';
    return NextResponse.redirect(destination);
  }

  const match = parseLocalizedPublicPath(request.nextUrl.pathname);
  if (match === null) return NextResponse.next();

  const destination = request.nextUrl.clone();
  destination.pathname = match.path;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-21gifts-public-locale', match.locale);
  const response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
  if (opensDocument(request)) {
    response.cookies.set(LOCALE_COOKIE, match.locale, {
      path: '/',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      sameSite: 'lax',
      secure: requestIsHttps(request),
    });
  }
  return response;
}

/** Match the public language URLs and the old map address. */
export const config = {
  matcher: ['/map', '/:locale(en|de|es|fil)', '/:locale(en|de|es|fil)/:path*'],
};
