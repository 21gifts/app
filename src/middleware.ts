import { NextResponse, type NextRequest } from 'next/server';
import { isSundayRest, sundayRetryAfter } from '@/lib/sunday-rest';

/**
 * Blocks application route handlers during Sunday; documents render only the rest gate.
 * @param request - Incoming web/PWA request.
 * @returns A non-cacheable rest error or the next application response.
 */
export function middleware(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/healthz') return NextResponse.next();
  const now = Date.now();
  const document =
    request.method === 'GET' &&
    (request.headers.get('accept')?.includes('text/html') || request.headers.get('rsc') === '1');
  if (isSundayRest(now) && document && request.nextUrl.pathname !== '/sunday-rest') {
    return NextResponse.rewrite(new URL('/sunday-rest', request.url), {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
  if (isSundayRest(now) && !document) {
    return NextResponse.json(
      { error: 'SUNDAY_REST', timeZone: 'Asia/Manila' },
      {
        status: 503,
        headers: { 'Cache-Control': 'no-store', 'Retry-After': String(sundayRetryAfter(now)) },
      },
    );
  }
  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

/** Static resources remain available so the rest page can render. */
export const config = {
  runtime: 'nodejs',
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.svg|apple-touch-icon.png|manifest.webmanifest|sw.js).*)',
  ],
};
