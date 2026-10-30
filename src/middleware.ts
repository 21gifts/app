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

/**
 * Query key the language rewrite adds to the rewritten page URL. The browser
 * URL keeps no query. The App Router keys a page by its query, so `/de/about`
 * and `/es/about` become two pages instead of one `/about` page that still
 * remembers `/de/about` as its refresh address after a client-side switch.
 */
const PUBLIC_LOCALE_QUERY = 'public-locale';

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

/**
 * Route public language URLs, remember that language, keep `/map` working,
 * and give every other matched request the Content-Security-Policy.
 *
 * `/map` keeps its query string and redirects to `/shops#map`, so `/map?pin=`
 * still selects that pin on `/shops?pin=#map`. There is no map page.
 *
 * A `/:locale(en|de|es|fil)` path for `/`, `/about`, `/donate`, or `/rules`
 * is rewritten onto the existing page. The locale is passed as the
 * `x-21gifts-public-locale` request header and as the {@link PUBLIC_LOCALE_QUERY}
 * query of the rewritten URL, so a client-side language switch followed by a
 * refresh renders the new language in the layouts too. The `locale` cookie is set when
 * the browser opens that language URL as a page (`sec-fetch-dest` is
 * `document`, or the header is absent), including a prerender (`purpose` or
 * `sec-purpose` contains `prerender`, any case). A prefetch that is not a
 * prerender does not set it: `purpose` or `sec-purpose` contains `prefetch`
 * and not `prerender` (any case). In-app navigations do not set it either:
 * `sec-fetch-dest` is present and is not `document`. The rewrite and
 * `x-21gifts-public-locale` stay the same in every case. Other paths,
 * including `/de/login`, are not rewritten and do not write the cookie.
 *
 * The policy carries a fresh nonce. It is set on the request too, so Next.js
 * and the root layout put the same nonce on their scripts, and on the
 * response, report-only unless `CSP_MODE=enforce`. A rewritten language URL
 * carries the policy the same way.
 *
 * @param request - The incoming request.
 * @returns The shops redirect, or the request passed on or rewritten with the
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

  const match = parseLocalizedPublicPath(request.nextUrl.pathname);
  let response: NextResponse;
  if (match === null) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    const destination = request.nextUrl.clone();
    destination.pathname = match.path;
    destination.searchParams.set(PUBLIC_LOCALE_QUERY, match.locale);
    requestHeaders.set('x-21gifts-public-locale', match.locale);
    response = NextResponse.rewrite(destination, { request: { headers: requestHeaders } });
    if (opensDocument(request)) {
      response.cookies.set(LOCALE_COOKIE, match.locale, {
        path: '/',
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: 'lax',
        secure: requestIsHttps(request),
      });
    }
  }
  response.headers.set(header, policy);
  response.headers.set('Reporting-Endpoints', `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`);
  return response;
}

/**
 * Pages and route handlers, including the public language URLs. Build
 * assets, the service worker, and files under `public/` are left out: they
 * are not documents.
 */
export const config = {
  matcher: [
    '/map',
    '/((?!_next/static|_next/image|sw\\.js|favicon\\.ico|favicon\\.svg|bitcoin-symbol\\.svg|apple-touch-icon\\.png|icon-192\\.png|icon-512\\.png|og\\.png|robots\\.txt|sitemap\\.xml|handbook-images/|happyland/).*)',
  ],
};
