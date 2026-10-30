import { proxyMeHeldSharesGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/me/held-shares`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyMeHeldSharesGet;
