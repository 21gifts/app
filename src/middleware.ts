import { NextResponse, type NextRequest } from 'next/server';
import { parseLocalizedPublicPath } from '@/lib/public-locale-path';

/**
 * Route public language URLs and keep the old `/map` link working.
 *
 * A `/:locale(en|de|es|fil)` path is rewritten onto the existing page
 * implementation with the locale passed down as a request header. `/map`
 * keeps its query string and redirects to the shops map (`/shops#map`);
 * there is no map page.
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
  return NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
}

/** Match the public language URLs and the old map address. */
export const config = {
  matcher: ['/map', '/:locale(en|de|es|fil)', '/:locale(en|de|es|fil)/:path*'],
};
