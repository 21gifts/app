import { proxyMeGet } from '@/lib/api-proxies';

/**
 * App Router GET for `/me`.
 *
 * @param request - Incoming request.
 * @returns The proxied upstream response.
 */
export const GET = proxyMeGet;
