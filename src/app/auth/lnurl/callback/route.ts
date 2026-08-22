import { proxyAuthLnurlCallbackGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/auth/lnurl/callback` (wallet LUD-04).
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyAuthLnurlCallbackGet;
