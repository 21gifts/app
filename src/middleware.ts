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

/** True when this opens as a page, including prerender, not a prefetch or in-app fetch. */
function opensDocument(request: NextRequest): boolean {
  const purpose = request.headers.get('purpose') ?? '';
  const secPurpose = request.headers.get('sec-purpose') ?? '';
  const hinted = `${purpose} ${secPurpose}`.toLowerCase();
  if (hinted.includes('prefetch') && !hinted.includes('prerender')) return false;
  const dest = request.headers.get('sec-fetch-dest');
  return dest === null || dest === 'document';
}

function applyCsp(request: NextRequest): {
  policy: string;
  header: string;
  requestHeaders: Headers;
} {
  const nonce = createCspNonce();
  const policy = buildCsp(nonce);
  const header = cspHeaderName(getCspMode());
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set(header, policy);
  return { policy, header, requestHeaders };
}

function attachCspResponse(response: NextResponse, header: string, policy: string): NextResponse {
  response.headers.set(header, policy);
  response.headers.set('Reporting-Endpoints', `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`);
  return response;
}

/**
 * `/map` redirect, locale rewrite of public pages, CSP nonce on every other
 * matched response.
 *
 * @param request - The incoming request.
 * @returns A redirect to the shops map, a locale rewrite, or the request
 * passed on with the policy headers.
 */
export function middleware(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === '/map') {
    const destination = new URL('/shops', request.url);
    destination.search = request.nextUrl.search;
    destination.hash = 'map';
    return NextResponse.redirect(destination);
  }

  const { policy, header, requestHeaders } = applyCsp(request);

  const match = parseLocalizedPublicPath(request.nextUrl.pathname);
  if (match !== null) {
    const destination = request.nextUrl.clone();
    destination.pathname = match.path;
    requestHeaders.set('x-21gifts-public-locale', match.locale);
    const response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
    attachCspResponse(response, header, policy);
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

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return attachCspResponse(response, header, policy);
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
