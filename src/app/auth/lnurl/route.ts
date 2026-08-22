import { proxyAuthLnurlGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/auth/lnurl`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyAuthLnurlGet;
