import { NextResponse, type NextRequest } from 'next/server';
import {
  buildCsp,
  createCspNonce,
  CSP_NONCE_HEADER,
  CSP_REPORT_GROUP,
  CSP_REPORT_PATH,
  cspHeaderName,
  getCspMode,
} from '@/lib/csp';

/**
 * Old `/map` links open the shops map; every other matched request gets the
 * Content-Security-Policy.
 *
 * The query string is kept, so `/map?pin=` still selects that pin on
 * `/shops?pin=#map`. There is no map page.
 *
 * The policy carries a fresh nonce. It is set on the request too, so Next.js
 * and the root layout put the same nonce on their scripts, and on the
 * response, report-only unless `CSP_MODE=enforce`.
 *
 * @param request - The incoming request.
 * @returns A redirect to the shops map, or the request passed on with the
 * policy headers.
 */
export function middleware(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/map') {
    const destination = new URL('/shops', request.url);
    destination.search = request.nextUrl.search;
    destination.hash = 'map';
    return NextResponse.redirect(destination);
  }
  const nonce = createCspNonce();
  const policy = buildCsp(nonce);
  const header = cspHeaderName(getCspMode());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set(header, policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(header, policy);
  response.headers.set('Reporting-Endpoints', `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`);
  return response;
}

/**
 * Pages and route handlers. Build assets, the service worker, and files
 * under `public/` are left out: they are not documents.
 */
export const config = {
  matcher: [
    '/map',
    '/((?!_next/static|_next/image|sw\\.js|favicon\\.ico|favicon\\.svg|apple-touch-icon\\.png|icon-192\\.png|icon-512\\.png|og\\.png|robots\\.txt|sitemap\\.xml|handbook-images/|happyland/).*)',
  ],
};
